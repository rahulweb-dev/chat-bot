import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import { getIO } from "@/server/socket";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const body = await request.json();
  const { agentId, note } = body;
  if (!agentId) return apiError("agentId required", 400);

  const old = await Conversation.findOne({ _id: id, companyId: ctx.companyId }).lean();
  if (!old) return apiError("Not found", 404);

  const conversation = await Conversation.findByIdAndUpdate(
    id,
    {
      $set: { assignedTo: agentId, status: "ASSIGNED" },
      $push: {
        transferHistory: {
          fromAgent: (old as { assignedTo?: unknown }).assignedTo,
          toAgent: agentId,
          note: note || "",
          transferredAt: new Date(),
          transferredBy: ctx.userId,
        },
      },
    },
    { new: true }
  );

  await Message.create({
    companyId: ctx.companyId,
    conversationId: id,
    senderType: "SYSTEM",
    type: "SYSTEM",
    content: `Chat transferred${note ? `: ${note}` : " to another agent"}`,
    isNote: false,
    isDelivered: true,
  });

  getIO()?.to(`user:${agentId}`).emit("conversation:assigned", { conversationId: id });
  getIO()?.to(`company:${ctx.companyId}`).emit("conversation:updated", { conversationId: id });
  getIO()?.to(`conversation:${id}`).emit("message:new", {
    _id: Date.now().toString(),
    conversationId: id,
    senderType: "SYSTEM",
    content: `Chat transferred${note ? `: ${note}` : " to another agent"}`,
    createdAt: new Date(),
  });

  return apiSuccess(conversation);
}
