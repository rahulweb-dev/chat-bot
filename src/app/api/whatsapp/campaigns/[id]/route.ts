import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";
import AuditLog from "@/models/AuditLog";
import { startCampaign } from "@/lib/queue/campaignScheduler";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const campaign = await WhatsAppCampaign.findOne({ _id: id, companyId: ctx.companyId });
  if (!campaign) return apiError("Not found", 404);

  const recipients = await WhatsAppCampaignRecipient.find({ campaignId: id }).limit(500);

  return apiSuccess({ campaign, recipients });
}

const DRAFT_FIELDS = [
  "name",
  "templateName",
  "templateLanguage",
  "audienceTags",
  "audienceContactIds",
  "offerTitle",
  "offerDescription",
  "offerImageUrl",
  "bannerImageUrl",
  "ctaType",
  "ctaUrl",
  "variables",
] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();

  if (body.action === "cancel") {
    const campaign = await WhatsAppCampaign.findOneAndUpdate(
      { _id: id, companyId: ctx.companyId, status: { $in: ["DRAFT", "SCHEDULED"] } },
      { status: "CANCELED" },
      { new: true }
    );
    if (!campaign) return apiError("Campaign cannot be canceled (already running or completed)", 400);

    await AuditLog.create({
      companyId: ctx.companyId, userId: ctx.userId, action: "CANCEL_WHATSAPP_CAMPAIGN",
      resource: "whatsapp_campaign", resourceId: id, status: "SUCCESS",
    });
    return apiSuccess(campaign, "Campaign canceled");
  }

  if (body.action === "schedule" || body.action === "launch") {
    const campaign = await WhatsAppCampaign.findOne({ _id: id, companyId: ctx.companyId, status: "DRAFT" });
    if (!campaign) return apiError("Campaign must be a draft to schedule or launch", 400);
    if (!campaign.templateName) return apiError("Select a template before launching", 400);
    if (!campaign.audienceTags.length && !campaign.audienceContactIds.length) {
      return apiError("Add recipients before launching", 400);
    }

    if (body.action === "schedule") {
      if (!body.scheduledAt) return apiError("scheduledAt is required to schedule a campaign", 400);
      campaign.status = "SCHEDULED";
      campaign.scheduledAt = new Date(body.scheduledAt);
      await campaign.save();
      await AuditLog.create({
        companyId: ctx.companyId, userId: ctx.userId, action: "SCHEDULE_WHATSAPP_CAMPAIGN",
        resource: "whatsapp_campaign", resourceId: id, details: { scheduledAt: body.scheduledAt }, status: "SUCCESS",
      });
      return apiSuccess(campaign, "Campaign scheduled");
    }

    await startCampaign(id);
    await AuditLog.create({
      companyId: ctx.companyId, userId: ctx.userId, action: "LAUNCH_WHATSAPP_CAMPAIGN",
      resource: "whatsapp_campaign", resourceId: id, status: "SUCCESS",
    });
    const launched = await WhatsAppCampaign.findById(id);
    return apiSuccess(launched, "Campaign launched");
  }

  // Plain draft field update (used by "Save Draft" across wizard steps)
  const update: Record<string, unknown> = {};
  for (const field of DRAFT_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field];
  }
  if (Object.keys(update).length === 0) return apiError("No recognized fields to update");

  const campaign = await WhatsAppCampaign.findOneAndUpdate(
    { _id: id, companyId: ctx.companyId, status: "DRAFT" },
    { $set: update },
    { new: true }
  );
  if (!campaign) return apiError("Draft not found or already launched", 404);

  return apiSuccess(campaign, "Draft saved");
}
