import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyToken } from "@/lib/jwt";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import User from "@/models/User";
import { autoAssignConversation } from "@/lib/auto-assign";
import { triggerTyping } from "@/lib/pusher";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  companyId?: string;
  viewingConversation?: string;
}

// Next.js bundles API route handlers separately from the custom server.ts process.
// A module-level `let io` would be a *different* binding when required from a route
// handler vs. imported from server.ts. Storing on globalThis guarantees every module
// instance in this Node process reads/writes the same Socket.IO server.
const globalForIO = globalThis as unknown as { __io?: SocketIOServer };

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (globalForIO.__io) return globalForIO.__io;

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");
    const widgetKey = socket.handshake.auth.widgetKey;

    if (widgetKey) {
      await connectDB();
      const { default: Company } = await import("@/models/Company");
      const company = await Company.findOne({ apiKey: widgetKey, isActive: true });
      if (!company) return next(new Error("Invalid widget key"));
      socket.companyId = company._id.toString();
      socket.userRole = "VISITOR";
      return next();
    }

    if (!token) return next(new Error("Authentication required"));

    // Try JWT first (API / mobile clients)
    try {
      const decoded = verifyToken(token);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.companyId = decoded.companyId;
      return next();
    } catch {
      // fall through to userId lookup
    }

    // Fallback: NextAuth dashboard passes user._id as the token
    try {
      await connectDB();
      const user = await User.findById(token)
        .select("role companyId isActive")
        .lean() as { role: string; companyId?: unknown; isActive: boolean } | null;
      if (user?.isActive) {
        socket.userId = token;
        socket.userRole = user.role;
        socket.companyId = (user.companyId as { toString(): string } | undefined)?.toString();
        return next();
      }
    } catch {
      // invalid ObjectId format or DB error
    }

    return next(new Error("Invalid token"));
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(`Socket connected: ${socket.id} (${socket.userRole})`);

    if (socket.companyId) {
      socket.join(`company:${socket.companyId}`);
    }

    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      User.findByIdAndUpdate(socket.userId, { isOnline: true, lastSeen: new Date() }).exec();
    }

    socket.on("join:conversation", async (conversationId: string) => {
      await connectDB();
      // Visitors must match their company. Agents join if conversation exists
      // (companyId may be undefined for super-admins — don't block them).
      const query: Record<string, unknown> = { _id: conversationId };
      if (socket.userRole === "VISITOR" && socket.companyId) {
        query.companyId = socket.companyId;
      } else if (socket.companyId) {
        query.companyId = socket.companyId;
      }
      const conversation = await Conversation.findOne(query);
      if (conversation) {
        // Leave previous conversation view first
        if (socket.viewingConversation && socket.viewingConversation !== conversationId && socket.userId && socket.userRole !== "VISITOR") {
          socket.to(`conversation:${socket.viewingConversation}`).emit("conversation:viewer:left", {
            userId: socket.userId,
            conversationId: socket.viewingConversation,
          });
          socket.leave(`conversation:${socket.viewingConversation}`);
        }
        socket.join(`conversation:${conversationId}`);
        socket.viewingConversation = conversationId;
        socket.emit("joined:conversation", { conversationId });
        // Broadcast to other agents viewing the same conversation
        if (socket.userId && socket.userRole !== "VISITOR") {
          const viewer = await User.findById(socket.userId).select("name").lean<{ name: string }>();
          socket.to(`conversation:${conversationId}`).emit("conversation:viewer:joined", {
            userId: socket.userId,
            name: viewer?.name || "Agent",
            conversationId,
          });
        }
      }
    });

    socket.on("leave:conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      if (socket.userId && socket.userRole !== "VISITOR" && socket.viewingConversation === conversationId) {
        socket.to(`conversation:${conversationId}`).emit("conversation:viewer:left", {
          userId: socket.userId,
          conversationId,
        });
        socket.viewingConversation = undefined;
      }
    });

    socket.on("message:send", async (data: {
      conversationId: string;
      content: string;
      type?: string;
      isNote?: boolean;
      attachments?: { name: string; url: string; type: string; size: number }[];
      replyTo?: string;
    }) => {
      await connectDB();

      const conversation = await Conversation.findOne({
        _id: data.conversationId,
        companyId: socket.companyId,
      });

      if (!conversation) {
        socket.emit("error", { message: "Conversation not found" });
        return;
      }

      const validTypes = ["TEXT", "IMAGE", "FILE", "VOICE", "VIDEO", "SYSTEM", "NOTE"] as const;
      type MessageType = typeof validTypes[number];
      const msgType: MessageType = validTypes.includes(data.type as MessageType) ? (data.type as MessageType) : "TEXT";

      const message = new Message({
        companyId: socket.companyId,
        conversationId: data.conversationId,
        senderId: socket.userId || undefined,
        senderType: socket.userRole === "VISITOR" ? "VISITOR" : "AGENT",
        type: msgType,
        content: data.content,
        isNote: data.isNote || false,
        attachments: data.attachments,
        replyTo: data.replyTo,
        isDelivered: true,
        deliveredAt: new Date(),
      });
      await message.save();

      await Conversation.findByIdAndUpdate(data.conversationId, {
        lastMessageAt: new Date(),
        $inc: { messageCount: 1 },
        ...(!conversation.firstResponseAt && socket.userRole !== "VISITOR"
          ? { firstResponseAt: new Date() }
          : {}),
      });

      const populated = await message.populate("senderId", "name avatar role");

      io.to(`conversation:${data.conversationId}`).emit("message:new", populated);
      io.to(`company:${socket.companyId}`).emit("conversation:updated", {
        conversationId: data.conversationId,
        lastMessage: data.content,
        lastMessageAt: new Date(),
      });
    });

    socket.on("typing:start", (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit("typing:start", {
        userId: socket.userId,
        conversationId: data.conversationId,
      });
      // Forward to visitor widget via Pusher
      if (socket.userRole !== "VISITOR") {
        triggerTyping(data.conversationId, { isTyping: true }).catch(() => {});
      }
    });

    socket.on("typing:stop", (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit("typing:stop", {
        userId: socket.userId,
        conversationId: data.conversationId,
      });
      if (socket.userRole !== "VISITOR") {
        triggerTyping(data.conversationId, { isTyping: false }).catch(() => {});
      }
    });

    socket.on("message:read", async (data: { conversationId: string; messageId: string }) => {
      await connectDB();
      await Message.findByIdAndUpdate(data.messageId, { isRead: true, readAt: new Date() });
      socket.to(`conversation:${data.conversationId}`).emit("message:read", {
        messageId: data.messageId,
        readAt: new Date(),
      });
    });

    socket.on("conversation:visitor:new", async (data: {
      visitorId: string;
      name?: string;
      email?: string;
      currentPage?: string;
      referrer?: string;
      userAgent?: string;
    }) => {
      await connectDB();

      const conversation = await Conversation.create({
        companyId: socket.companyId,
        status: "OPEN",
        visitor: {
          visitorId: data.visitorId,
          name: data.name,
          email: data.email,
          currentPage: data.currentPage,
          referrer: data.referrer,
          userAgent: data.userAgent,
          isLoggedIn: false,
        },
      });

      socket.join(`conversation:${conversation._id}`);
      socket.emit("conversation:created", { conversationId: conversation._id });

      const { assigned, agent } = await autoAssignConversation(
        socket.companyId!,
        conversation._id.toString()
      );

      if (assigned && agent) {
        io.to(`user:${agent._id}`).emit("conversation:assigned", {
          conversationId: conversation._id,
          visitor: data,
        });
      }

      io.to(`company:${socket.companyId}`).emit("conversation:new", {
        conversationId: conversation._id,
        visitor: data,
        assignedTo: assigned ? agent?._id : null,
      });
    });

    socket.on("agent:status", async (data: { status: "online" | "offline" | "busy" }) => {
      if (!socket.userId) return;
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: data.status === "online",
        lastSeen: new Date(),
      });
      io.to(`company:${socket.companyId}`).emit("agent:status:changed", {
        agentId: socket.userId,
        status: data.status,
      });
    });

    socket.on("disconnect", async () => {
      if (socket.userId) {
        // Notify if this agent was viewing a conversation
        if (socket.viewingConversation && socket.userRole !== "VISITOR") {
          io.to(`conversation:${socket.viewingConversation}`).emit("conversation:viewer:left", {
            userId: socket.userId,
            conversationId: socket.viewingConversation,
          });
        }
        await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: new Date() });
        io.to(`company:${socket.companyId}`).emit("agent:status:changed", {
          agentId: socket.userId,
          status: "offline",
        });
      }
    });
  });

  // Auto-close inactive conversations every 30 minutes
  setInterval(async () => {
    try {
      await connectDB();
      const { default: Settings } = await import("@/models/Settings");
      const configs = await Settings.find({ "chat.autoCloseTimeout": { $gt: 0 } })
        .select("companyId chat.autoCloseTimeout")
        .lean<{ companyId: string; chat: { autoCloseTimeout: number } }[]>();

      for (const cfg of configs) {
        const hours = cfg.chat.autoCloseTimeout;
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        const companyIdStr = String(cfg.companyId);
        const result = await Conversation.updateMany(
          {
            companyId: companyIdStr,
            status: { $in: ["OPEN", "PENDING"] },
            lastMessageAt: { $lt: cutoff },
          },
          { $set: { status: "RESOLVED", resolvedAt: new Date() } }
        );
        if (result.modifiedCount > 0) {
          io.to(`company:${companyIdStr}`).emit("conversations:auto-closed", {
            count: result.modifiedCount,
          });
        }
      }
    } catch (e) {
      console.error("[auto-close]", e);
    }
  }, 30 * 60 * 1000);

  globalForIO.__io = io;
  return io;
}

export function getIO(): SocketIOServer | undefined {
  return globalForIO.__io;
}

