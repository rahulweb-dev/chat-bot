import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import WhatsAppConversation from "@/models/WhatsAppConversation";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const query: Record<string, unknown> = { _id: id };
  if (ctx.companyId) query.companyId = ctx.companyId;
  if (ctx.userRole === "AGENT") query.assignedAgentId = ctx.userId;

  const conversation = await WhatsAppConversation.findOne(query).populate("assignedAgentId", "name email avatar isOnline");
  if (!conversation) return apiError("Not found", 404);

  return apiSuccess(conversation);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const body = await request.json();
  const { status, tags, assignedAgentId, unreadCount } = body;

  const update: Record<string, unknown> = {};
  if (status) update.status = status;
  if (tags) update.tags = tags;
  if (assignedAgentId !== undefined) update.assignedAgentId = assignedAgentId || null;
  if (unreadCount !== undefined) update.unreadCount = unreadCount;

  const conversation = await WhatsAppConversation.findOneAndUpdate(
    { _id: id, companyId: ctx.companyId },
    { $set: update },
    { new: true }
  ).populate("assignedAgentId", "name email isOnline");

  if (!conversation) return apiError("Not found", 404);

  return apiSuccess(conversation, "Conversation updated");
}
