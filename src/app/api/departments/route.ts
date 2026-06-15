import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, checkUsageLimit, incrementUsage } from "@/lib/api-helpers";
import Department from "@/models/Department";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company context required", 400);

  await connectDB();
  const departments = await Department.find({ companyId: ctx.companyId, isActive: true })
    .populate("managerId", "name email avatar")
    .populate("agentIds", "name email avatar isOnline")
    .sort({ name: 1 });

  return apiSuccess(departments);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const body = await request.json();

  const usageCheck = await checkUsageLimit(ctx.companyId, "departments" as keyof import("@/models/Usage").IUsage);
  if (!usageCheck.allowed) {
    return apiError(`Department limit reached (${usageCheck.limit}). Please upgrade your plan.`, 403);
  }

  const department = await Department.create({ ...body, companyId: ctx.companyId });
  await incrementUsage(ctx.companyId, "departments");

  return apiSuccess(department, "Department created", 201);
}
