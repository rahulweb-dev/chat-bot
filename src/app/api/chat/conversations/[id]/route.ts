import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Conversation from "@/models/Conversation";
import AuditLog from "@/models/AuditLog";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const query: Record<string, unknown> = { _id: id };
  if (ctx.companyId) query.companyId = ctx.companyId;
  if (ctx.userRole === "AGENT") query.assignedTo = ctx.userId;

  const conversation = await Conversation.findOne(query)
    .populate("assignedTo", "name email avatar isOnline")
    .populate("departmentId", "name");

  if (!conversation) return apiError("Not found", 404);

  return apiSuccess(conversation);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const body = await request.json();
  const { status, priority, tags, ...rest } = body;

  const update: Record<string, unknown> = { ...rest };
  if (status) {
    update.status = status;
    if (status === "RESOLVED") update.resolvedAt = new Date();
    if (status === "CLOSED") update.closedAt = new Date();
  }
  if (priority) update.priority = priority;
  if (tags) update.tags = tags;

  const conversation = await Conversation.findOneAndUpdate(
    { _id: id, companyId: ctx.companyId },
    { $set: update },
    { new: true }
  ).populate("assignedTo", "name email isOnline");

  if (!conversation) return apiError("Not found", 404);

  if (status) {
    await AuditLog.create({
      companyId: ctx.companyId,
      userId: ctx.userId,
      action: "UPDATE_CONVERSATION_STATUS",
      resource: "conversation",
      resourceId: id,
      details: { status },
      status: "SUCCESS",
    });
  }

  return apiSuccess(conversation, "Conversation updated");
}
