import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, paginatedResponse, paginate } from "@/lib/api-helpers";
import WhatsAppConversation from "@/models/WhatsAppConversation";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status");
  const assignedTo = searchParams.get("assignedTo");
  const search = searchParams.get("search");

  const query: Record<string, unknown> = { companyId: ctx.companyId };
  if (status) query.status = status;

  if (ctx.userRole === "AGENT") {
    query.assignedAgentId = ctx.userId;
  } else if (assignedTo) {
    query.assignedAgentId = assignedTo;
  }

  if (search) {
    query.$or = [
      { customerName: { $regex: search, $options: "i" } },
      { customerPhone: { $regex: search, $options: "i" } },
    ];
  }

  const { skip } = paginate(page, limit);
  const [conversations, total] = await Promise.all([
    WhatsAppConversation.find(query)
      .populate("assignedAgentId", "name email avatar isOnline")
      .skip(skip)
      .limit(limit)
      .sort({ lastMessageAt: -1, createdAt: -1 }),
    WhatsAppConversation.countDocuments(query),
  ]);

  return paginatedResponse(conversations, total, page, limit);
}
