import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Company from "@/models/Company";
import AuditLog from "@/models/AuditLog";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  const { id } = await params;
  const { reason } = await request.json();

  await connectDB();
  const company = await Company.findByIdAndUpdate(
    id,
    { isSuspended: true, suspendReason: reason },
    { new: true }
  );
  if (!company) return apiError("Company not found", 404);

  await AuditLog.create({
    companyId: id,
    userId: ctx.userId,
    action: "SUSPEND_COMPANY",
    resource: "company",
    resourceId: id,
    details: { reason },
    status: "SUCCESS",
  });

  return apiSuccess(company, "Company suspended");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  const { id } = await params;
  await connectDB();

  const company = await Company.findByIdAndUpdate(id, { isSuspended: false, suspendReason: null }, { new: true });
  if (!company) return apiError("Company not found", 404);

  return apiSuccess(company, "Company unsuspended");
}
