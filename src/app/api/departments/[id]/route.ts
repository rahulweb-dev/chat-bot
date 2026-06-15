import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Department from "@/models/Department";
import AuditLog from "@/models/AuditLog";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const dept = await Department.findOne({ _id: id, companyId: ctx.companyId });
  if (!dept) return apiError("Not found", 404);

  return apiSuccess(dept);
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
  const dept = await Department.findOneAndUpdate(
    { _id: id, companyId: ctx.companyId },
    { $set: body },
    { new: true }
  );
  if (!dept) return apiError("Not found", 404);

  return apiSuccess(dept, "Department updated");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const dept = await Department.findOneAndDelete({ _id: id, companyId: ctx.companyId });
  if (!dept) return apiError("Not found", 404);

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "DELETE_DEPARTMENT",
    resource: "department",
    resourceId: id,
    details: { name: dept.name },
    status: "SUCCESS",
  });

  return apiSuccess(null, "Department deleted");
}
