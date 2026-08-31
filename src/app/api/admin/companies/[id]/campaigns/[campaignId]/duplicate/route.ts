import { NextRequest } from "next/server";
import { Model as MongooseModel } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { requireSuperAdminForCompany, isAdminContextError } from "@/lib/admin-helpers";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import RCSCampaign from "@/models/RCSCampaign";
import EmailCampaign from "@/models/EmailCampaign";
import AuditLog from "@/models/AuditLog";
import { invalidateCachedJson } from "@/lib/admin-cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODELS: Record<string, MongooseModel<any>> = { WHATSAPP: WhatsAppCampaign, RCS: RCSCampaign, EMAIL: EmailCampaign };

// Only content/audience fields are copied — never status, stats, schedule, or
// failure state, so the clone always lands as a fresh, unsent DRAFT regardless of
// what state the original campaign was in.
const COPY_FIELDS: Record<string, string[]> = {
  WHATSAPP: ["templateName", "templateLanguage", "audienceTags", "audienceContactIds", "offerTitle", "offerDescription", "offerImageUrl", "bannerImageUrl", "ctaType", "ctaUrl", "variables"],
  RCS: ["body", "audienceTags", "audienceContactIds"],
  EMAIL: ["subject", "fromName", "html", "audienceTags", "audienceContactIds"],
};

type Channel = "WHATSAPP" | "RCS" | "EMAIL";

// Admin-triggered clone of a company's campaign into a new DRAFT — lets an admin
// (or the company, once they log in) relaunch a past campaign without rebuilding
// it from scratch. Recipients aren't copied: the original wizard flow generates
// recipient rows at launch time from audienceTags/audienceContactIds, so the
// clone will re-resolve its own audience when it's eventually launched.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  const { id, campaignId } = await params;
  const ctx = await requireSuperAdminForCompany(request, id);
  if (isAdminContextError(ctx)) return apiError(ctx.error, ctx.status);

  const { searchParams } = new URL(request.url);
  const channel = (searchParams.get("channel") || "").toUpperCase() as Channel;
  const Model = MODELS[channel];
  if (!Model) return apiError("channel must be WHATSAPP, RCS, or EMAIL", 400);

  await connectDB();
  const original = await Model.findOne({ _id: campaignId, companyId: id }).lean();
  if (!original) return apiError("Not found", 404);

  const fields = COPY_FIELDS[channel];
  const payload: Record<string, unknown> = { companyId: id, createdBy: ctx.userId, name: `${original.name} (Copy)`, status: "DRAFT" };
  for (const f of fields) {
    if (original[f] !== undefined) payload[f] = original[f];
  }

  const clone = await Model.create(payload);

  await AuditLog.create({
    companyId: id,
    userId: ctx.userId,
    action: "ADMIN_DUPLICATE_CAMPAIGN",
    resource: `${channel.toLowerCase()}_campaign`,
    resourceId: String(clone._id),
    details: { sourceCampaignId: campaignId, name: clone.name, channel },
    status: "SUCCESS",
  });
  await invalidateCachedJson(`campaign-stats:${id}`);

  return apiSuccess({ campaign: clone }, "Campaign duplicated as a draft");
}
