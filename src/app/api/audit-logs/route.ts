import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, paginatedResponse, paginate } from "@/lib/api-helpers";
import AuditLog from "@/models/AuditLog";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const { skip } = paginate(page, limit);

  const query: Record<string, unknown> = {};
  if (ctx.userRole !== "SUPER_ADMIN") query.companyId = ctx.companyId;

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate("userId", "name email")
      .skip(skip).limit(limit).sort({ createdAt: -1 }),
    AuditLog.countDocuments(query),
  ]);

  return paginatedResponse(logs, total, page, limit);
}
