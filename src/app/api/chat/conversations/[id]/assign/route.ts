import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Conversation from "@/models/Conversation";
import Notification from "@/models/Notification";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { agentId: bodyAgentId, departmentId, reason } = body as {
    agentId?: string; departmentId?: string; reason?: string;
  };

  // Self-assign when no agentId provided — any authenticated user can claim a conversation
  const agentId = bodyAgentId || ctx.userId;

  await connectDB();

  const conversation = await Conversation.findOne({ _id: id, companyId: ctx.companyId });
  if (!conversation) return apiError("Conversation not found", 404);

  const updateData: Record<string, unknown> = {
    status: "ASSIGNED",
    assignedTo: agentId,
    "metadata.needsAgent": false,
  };
  if (departmentId) updateData.departmentId = departmentId;

  // Record transfer history when reassigning to a different agent
  if (agentId && conversation.assignedTo?.toString() !== agentId) {
    updateData.$push = {
      transferHistory: {
        from: conversation.assignedTo,
        to: agentId,
        reason,
        transferredAt: new Date(),
        transferredBy: ctx.userId,
      },
    };
    // Only notify the target agent if it's not a self-assign
    if (bodyAgentId && bodyAgentId !== ctx.userId) {
      await Notification.create({
        companyId: ctx.companyId,
        userId: agentId,
        type: "NEW_CHAT",
        title: "New Conversation Assigned",
        message: `A conversation has been assigned to you`,
        data: { conversationId: id },
        link: `/dashboard/chat?conversation=${id}`,
      });
    }
  }

  const updated = await Conversation.findByIdAndUpdate(id, updateData, { new: true })
    .populate("assignedTo", "name email avatar");

  return apiSuccess(updated, "Conversation assigned");
}
