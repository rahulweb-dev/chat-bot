import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { apiError, paginatedResponse, paginate } from "@/lib/api-helpers";
import { requireSuperAdminForCompany, isAdminContextError } from "@/lib/admin-helpers";
import WhatsAppConversation from "@/models/WhatsAppConversation";

// Company-wide WhatsApp conversation list (the closest real thing to "all replies")
// — RCS and Email have no equivalent capture, see the per-campaign replies route
// for why; this route only ever returns WhatsApp data, the frontend shows the
// other two channels as explicitly unavailable without calling this at all.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSuperAdminForCompany(request, id);
  if (isAdminContextError(ctx)) return apiError(ctx.error, ctx.status);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50")));

  const query: Record<string, unknown> = { companyId: id };
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { customerName: { $regex: search, $options: "i" } },
      { customerPhone: { $regex: search, $options: "i" } },
    ];
  }

  const { skip } = paginate(page, limit);
  const [conversations, total] = await Promise.all([
    WhatsAppConversation.find(query).populate("assignedAgentId", "name").sort({ lastMessageAt: -1 }).skip(skip).limit(limit).lean(),
    WhatsAppConversation.countDocuments(query),
  ]);

  return paginatedResponse(conversations, total, page, limit);
}
