import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import ApiKey from "@/models/ApiKey";
import AuditLog from "@/models/AuditLog";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const key = await ApiKey.findOneAndUpdate(
    { _id: id, companyId: ctx.companyId },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!key) return apiError("Not found", 404);

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "REVOKE_API_KEY",
    resource: "api_key",
    resourceId: id,
    details: { name: key.name },
    status: "SUCCESS",
  });

  return apiSuccess(null, "API key revoked");
}
