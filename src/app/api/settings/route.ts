import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Settings from "@/models/Settings";
import AuditLog from "@/models/AuditLog";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  let settings = await Settings.findOne({ companyId: ctx.companyId });
  if (!settings) {
    settings = await Settings.create({ companyId: ctx.companyId });
  }

  return apiSuccess(settings);
}

export async function PATCH(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const body = await request.json();

  const updateFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "object" && !Array.isArray(value)) {
      for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
        updateFields[`${key}.${subKey}`] = subVal;
      }
    } else {
      updateFields[key] = value;
    }
  }

  const settings = await Settings.findOneAndUpdate(
    { companyId: ctx.companyId },
    { $set: updateFields },
    { new: true, upsert: true }
  );

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "UPDATE_SETTINGS",
    resource: "settings",
    details: body,
    status: "SUCCESS",
  });

  return apiSuccess(settings, "Settings updated");
}
