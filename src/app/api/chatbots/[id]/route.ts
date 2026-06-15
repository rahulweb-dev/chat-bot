import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Chatbot from "@/models/Chatbot";
import AuditLog from "@/models/AuditLog";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const chatbot = await Chatbot.findOne({ _id: id, companyId: ctx.companyId });
  if (!chatbot) return apiError("Not found", 404);

  return apiSuccess(chatbot);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const body = await request.json();
  const chatbot = await Chatbot.findOneAndUpdate(
    { _id: id, companyId: ctx.companyId },
    { $set: body },
    { new: true }
  );
  if (!chatbot) return apiError("Not found", 404);

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "UPDATE_CHATBOT",
    resource: "chatbot",
    resourceId: id,
    details: body,
    status: "SUCCESS",
  });

  return apiSuccess(chatbot, "Chatbot updated");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const chatbot = await Chatbot.findOneAndDelete({ _id: id, companyId: ctx.companyId });
  if (!chatbot) return apiError("Not found", 404);

  return apiSuccess(null, "Chatbot deleted");
}
