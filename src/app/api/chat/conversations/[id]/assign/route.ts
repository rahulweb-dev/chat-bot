import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Conversation from "@/models/Conversation";
import Notification from "@/models/Notification";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "TEAM_LEADER"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  const { id } = await params;
  const { agentId, departmentId, reason } = await request.json();

  await connectDB();

  const conversation = await Conversation.findOne({ _id: id, companyId: ctx.companyId });
  if (!conversation) return apiError("Conversation not found", 404);

  const updateData: Record<string, unknown> = { status: "ASSIGNED" };
  if (agentId) updateData.assignedTo = agentId;
  if (departmentId) updateData.departmentId = departmentId;

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

  const updated = await Conversation.findByIdAndUpdate(id, updateData, { new: true })
    .populate("assignedTo", "name email avatar");

  return apiSuccess(updated, "Conversation assigned");
}
