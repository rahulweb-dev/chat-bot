import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, sanitizeForLog } from "@/lib/api-helpers";
import Company from "@/models/Company";
import Plan from "@/models/Plan";
import Subscription from "@/models/Subscription";
import AuditLog from "@/models/AuditLog";

// Fields a COMPANY_ADMIN may change on their own company
const companyAdminUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  settings: z
    .object({
      brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color").optional(),
      widgetPosition: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).optional(),
      welcomeMessage: z.string().max(500).optional(),
      autoAssign: z.boolean().optional(),
      assignmentStrategy: z.enum(["ROUND_ROBIN", "LEAST_BUSY", "MANUAL"]).optional(),
      chatRating: z.boolean().optional(),
      offlineMessage: z.string().max(500).optional(),
    })
    .optional(),
});

// SUPER_ADMIN gets the same fields plus plan/active state
const superAdminUpdateSchema = companyAdminUpdateSchema.extend({
  planId: z.string().length(24).optional(),
  isActive: z.boolean().optional(),
  trialEndsAt: z.string().datetime({ offset: true }).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { id } = await params;
  await connectDB();

  if (ctx.userRole !== "SUPER_ADMIN" && ctx.companyId !== id) {
    return apiError("Forbidden", 403);
  }

  const company = await Company.findById(id)
    .populate({ path: "planId", model: Plan })
    .populate({ path: "subscriptionId", model: Subscription });
  if (!company) return apiError("Company not found", 404);

  return apiSuccess(company);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { id } = await params;
  await connectDB();

  const isSuperAdmin = ctx.userRole === "SUPER_ADMIN";
  const isOwnCompanyAdmin = ctx.companyId === id && ctx.userRole === "COMPANY_ADMIN";

  if (!isSuperAdmin && !isOwnCompanyAdmin) {
    return apiError("Forbidden", 403);
  }

  const raw = await request.json();
  const schema = isSuperAdmin ? superAdminUpdateSchema : companyAdminUpdateSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  // Reject empty update
  if (Object.keys(parsed.data).length === 0) return apiError("No valid fields to update", 422);

  const company = await Company.findByIdAndUpdate(id, parsed.data, { new: true });
  if (!company) return apiError("Company not found", 404);

  await AuditLog.create({
    companyId: id,
    userId: ctx.userId,
    action: "UPDATE_COMPANY",
    resource: "company",
    resourceId: id,
    details: sanitizeForLog(parsed.data as Record<string, unknown>),
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
    companyId: id,
    userId: ctx.userId,
    action: "DELETE_COMPANY",
    resource: "company",
    resourceId: id,
    status: "SUCCESS",
  });

  return apiSuccess(null, "Company deleted");
}
