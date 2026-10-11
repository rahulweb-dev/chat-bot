import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { canWhiteLabel, getBranding } from "@/lib/white-label";
import Company from "@/models/Company";

// Branding for the signed-in user's company (sidebar, settings card).
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiSuccess({ allowed: false, hidePoweredBy: false });
  const branding = await getBranding(ctx.companyId);
  // The admin's form needs the saved values even if they're not active.
  await connectDB();
  const saved = await Company.findById(ctx.companyId).select("whiteLabelSettings").lean<{ whiteLabelSettings?: Record<string, unknown> }>();
  return apiSuccess({ ...branding, saved: saved?.whiteLabelSettings ?? {} });
}

const schema = z.object({
  brandName: z.string().max(40).optional(),
  brandLogo: z.string().url().or(z.literal("")).optional(),
  hideBranding: z.boolean().optional(),
  poweredByText: z.string().max(60).optional(),
  poweredByUrl: z.string().url().or(z.literal("")).optional(),
});

export async function PATCH(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) return apiError("Only the company admin can change branding", 403);
  if (!(await canWhiteLabel(ctx.companyId))) return apiError("White labeling is part of the Enterprise plan. Upgrade on the Billing page.", 403);

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  await connectDB();
  const set = Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [`whiteLabelSettings.${k}`, v]));
  await Company.updateOne({ _id: ctx.companyId }, { $set: set });
  return apiSuccess(await getBranding(ctx.companyId), "Branding saved");
}
