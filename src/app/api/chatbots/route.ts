import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, checkUsageLimit, incrementUsage, paginatedResponse, paginate } from "@/lib/api-helpers";
import Chatbot from "@/models/Chatbot";
import AuditLog from "@/models/AuditLog";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const { skip } = paginate(page, limit);

  const [chatbots, total] = await Promise.all([
    Chatbot.find({ companyId: ctx.companyId }).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Chatbot.countDocuments({ companyId: ctx.companyId }),
  ]);

  return paginatedResponse(chatbots, total, page, limit);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  const limitCheck = await checkUsageLimit(ctx.companyId, "chatbots");
  if (!limitCheck.allowed) return apiError(limitCheck.message || "Chatbot limit reached", 403);

  await connectDB();
  const body = await request.json();

  const chatbot = await Chatbot.create({ ...body, companyId: ctx.companyId });

  await incrementUsage(ctx.companyId, "chatbots");
  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "CREATE_CHATBOT",
    resource: "chatbot",
    resourceId: chatbot._id.toString(),
    details: { name: chatbot.name },
    status: "SUCCESS",
  });

  return apiSuccess(chatbot, "Chatbot created", 201);
}
