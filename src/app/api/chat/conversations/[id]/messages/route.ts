import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, incrementUsage } from "@/lib/api-helpers";
import Message from "@/models/Message";
import Conversation from "@/models/Conversation";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { id } = await params;
  await connectDB();

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const conversation = await Conversation.findOne({ _id: id, companyId: ctx.companyId });
  if (!conversation) return apiError("Conversation not found", 404);

  const [messages, total] = await Promise.all([
    Message.find({ conversationId: id, companyId: ctx.companyId })
      .populate("senderId", "name avatar role")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: 1 }),
    Message.countDocuments({ conversationId: id, companyId: ctx.companyId }),
  ]);

  return apiSuccess({ messages, total, page, limit });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { id } = await params;
  await connectDB();

  const conversation = await Conversation.findOne({ _id: id, companyId: ctx.companyId });
  if (!conversation) return apiError("Conversation not found", 404);

  const body = await request.json();
  const { content, type = "TEXT", isNote = false, attachments, replyTo } = body;

  if (!content) return apiError("Message content required");

  const message = await Message.create({
    companyId: ctx.companyId,
    conversationId: id,
    senderId: ctx.userId !== "api" ? ctx.userId : undefined,
    senderType: "AGENT",
    type,
    content,
    isNote,
    attachments,
    replyTo,
    isDelivered: true,
    deliveredAt: new Date(),
  });

  await Conversation.findByIdAndUpdate(id, {
    lastMessageAt: new Date(),
    $inc: { messageCount: 1 },
    ...(isNote ? {} : { firstResponseAt: conversation.firstResponseAt || new Date() }),
  });

  if (!isNote) {
    await incrementUsage(ctx.companyId!, "chats");
  }

  const populated = await message.populate("senderId", "name avatar role");
  return apiSuccess(populated, "Message sent", 201);
}
