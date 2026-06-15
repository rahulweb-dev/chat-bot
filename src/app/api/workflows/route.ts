import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, checkUsageLimit, incrementUsage, paginatedResponse, paginate } from "@/lib/api-helpers";
import Workflow from "@/models/Workflow";
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

  const [workflows, total] = await Promise.all([
    Workflow.find({ companyId: ctx.companyId }).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Workflow.countDocuments({ companyId: ctx.companyId }),
  ]);

  return paginatedResponse(workflows, total, page, limit);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  const limitCheck = await checkUsageLimit(ctx.companyId, "workflows");
  if (!limitCheck.allowed) return apiError(limitCheck.message || "Workflow limit reached", 403);

  await connectDB();
  const body = await request.json();

  const workflow = await Workflow.create({
    ...body,
    companyId: ctx.companyId,
    createdBy: ctx.userId,
  });

  await incrementUsage(ctx.companyId, "workflows");
  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "CREATE_WORKFLOW",
    resource: "workflow",
    resourceId: workflow._id.toString(),
    details: { name: workflow.name },
    status: "SUCCESS",
  });

  return apiSuccess(workflow, "Workflow created", 201);
}
