import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyToken } from "@/lib/jwt";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import User from "@/models/User";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  companyId?: string;
}

let io: SocketIOServer;

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
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
      const conversation = await Conversation.findOne({
        _id: conversationId,
        companyId: socket.companyId,
      });
      if (conversation) {
        socket.join(`conversation:${conversationId}`);
        socket.emit("joined:conversation", { conversationId });
      }
    });

    socket.on("leave:conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
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
    });

    socket.on("typing:stop", (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit("typing:stop", {
        userId: socket.userId,
        conversationId: data.conversationId,
      });
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

      const autoAssignAgent = await findAvailableAgent(socket.companyId!);
      if (autoAssignAgent) {
        await Conversation.findByIdAndUpdate(conversation._id, {
          assignedTo: autoAssignAgent._id,
          status: "ASSIGNED",
        });
        io.to(`user:${autoAssignAgent._id}`).emit("conversation:assigned", {
          conversationId: conversation._id,
          visitor: data,
        });
      }

      io.to(`company:${socket.companyId}`).emit("conversation:new", {
        conversationId: conversation._id,
        visitor: data,
        assignedTo: autoAssignAgent?._id,
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
        await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: new Date() });
        io.to(`company:${socket.companyId}`).emit("agent:status:changed", {
          agentId: socket.userId,
          status: "offline",
        });
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  return io;
}

async function findAvailableAgent(companyId: string) {
  await connectDB();
  const agents = await User.find({
    companyId,
    role: { $in: ["AGENT", "TEAM_LEADER"] },
    isActive: true,
    isOnline: true,
  });

  if (!agents.length) return null;

  const agentWithCounts = await Promise.all(
    agents.map(async (agent) => {
      const activeChats = await Conversation.countDocuments({
        companyId,
        assignedTo: agent._id,
        status: { $in: ["OPEN", "ASSIGNED"] },
      });
      return { agent, activeChats };
    })
  );

  agentWithCounts.sort((a, b) => a.activeChats - b.activeChats);
  const available = agentWithCounts.find((a) => a.activeChats < a.agent.maxConcurrentChats);

  return available?.agent || null;
}

export { io };
