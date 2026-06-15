import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Company from "@/models/Company";
import AuditLog from "@/models/AuditLog";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { id } = await params;
  await connectDB();

  if (ctx.userRole !== "SUPER_ADMIN" && ctx.companyId !== id) {
    return apiError("Forbidden", 403);
  }

  const company = await Company.findById(id).populate("planId").populate("subscriptionId");
  if (!company) return apiError("Company not found", 404);

  return apiSuccess(company);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { id } = await params;
  await connectDB();

  if (ctx.userRole !== "SUPER_ADMIN" && (ctx.companyId !== id || ctx.userRole !== "COMPANY_ADMIN")) {
    return apiError("Forbidden", 403);
  }

  const body = await request.json();
  const company = await Company.findByIdAndUpdate(id, body, { new: true });
  if (!company) return apiError("Company not found", 404);

  await AuditLog.create({
    companyId: id,
    userId: ctx.userId,
    action: "UPDATE_COMPANY",
    resource: "company",
    resourceId: id,
    details: body,
    status: "SUCCESS",
  });

  return apiSuccess(company, "Company updated");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  const { id } = await params;
  await connectDB();

  await Company.findByIdAndDelete(id);

  await AuditLog.create({
    userId: ctx.userId,
    action: "DELETE_COMPANY",
    resource: "company",
    resourceId: id,
    status: "SUCCESS",
  });

  return apiSuccess(null, "Company deleted");
}
