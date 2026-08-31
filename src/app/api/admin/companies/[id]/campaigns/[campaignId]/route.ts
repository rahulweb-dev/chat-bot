import { NextRequest } from "next/server";
import { Model as MongooseModel } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { requireSuperAdminForCompany, isAdminContextError, logAdminAudit } from "@/lib/admin-helpers";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import RCSCampaign from "@/models/RCSCampaign";
import EmailCampaign from "@/models/EmailCampaign";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";
import RCSCampaignRecipient from "@/models/RCSCampaignRecipient";
import EmailCampaignRecipient from "@/models/EmailCampaignRecipient";
import { invalidateCachedJson } from "@/lib/admin-cache";

// Cast to a loose Model<any> map — see the sibling recipients route for why.
/* eslint-disable @typescript-eslint/no-explicit-any */
const MODELS: Record<string, MongooseModel<any>> = { WHATSAPP: WhatsAppCampaign, RCS: RCSCampaign, EMAIL: EmailCampaign };
const RECIPIENT_MODELS: Record<string, MongooseModel<any>> = { WHATSAPP: WhatsAppCampaignRecipient, RCS: RCSCampaignRecipient, EMAIL: EmailCampaignRecipient };
/* eslint-enable @typescript-eslint/no-explicit-any */
type Channel = "WHATSAPP" | "RCS" | "EMAIL";

function pct(num: number, denom: number): number {
  if (!denom) return 0;
  return Math.round((num / denom) * 1000) / 10;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  const { id, campaignId } = await params;
  const ctx = await requireSuperAdminForCompany(request, id);
  if (isAdminContextError(ctx)) return apiError(ctx.error, ctx.status);

  const { searchParams } = new URL(request.url);
  const channel = (searchParams.get("channel") || "").toUpperCase() as Channel;
  const Model = MODELS[channel];
  if (!Model) return apiError("channel must be WHATSAPP, RCS, or EMAIL", 400);

  await connectDB();
  const campaign = await Model.findOne({ _id: campaignId, companyId: id }).lean();
  if (!campaign) return apiError("Not found", 404);

  const s = (campaign as { stats?: Record<string, number> }).stats || {};
  const total = s.total || 0;
  const sent = s.sent || 0;
  const delivered = s.delivered || 0;
  const failed = s.failed || 0;
  const pending = Math.max(0, total - sent - failed);
  const readOrOpened = s.read ?? s.opened ?? 0;
  const clicked = s.clicked || 0;
  const bounced = s.bounced || 0; // email only

  const rates: Record<string, number> = {
    deliveryRate: pct(delivered, total),
    failureRate: pct(failed, total),
  };
  if (channel === "EMAIL") {
    rates.bounceRate = pct(bounced, total);
    rates.openRate = pct(readOrOpened, delivered);
    rates.clickRate = pct(clicked, delivered);
  } else {
    // WHATSAPP / RCS
    rates.readRate = pct(readOrOpened, delivered);
    if (channel === "RCS") rates.clickRate = pct(clicked, delivered);
  }

  return apiSuccess({
    campaign,
    channel,
    performance: { total, sent, delivered, failed, pending, readOrOpened, clicked, bounced },
    rates,
  });
}

// Deleting a campaign that's actively sending would leave the running job pointed
// at recipients/state that no longer exist, so this only allows it for campaigns
// that aren't RUNNING. Company-side campaign cancellation is a separate, already
// safe flow (PATCH .../campaigns/[id] with action:"cancel"); this is purely an
// admin cleanup action, and it's logged to AuditLog like every other destructive
// admin action in this app.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  const { id, campaignId } = await params;
  const ctx = await requireSuperAdminForCompany(request, id);
  if (isAdminContextError(ctx)) return apiError(ctx.error, ctx.status);

  const { searchParams } = new URL(request.url);
  const channel = (searchParams.get("channel") || "").toUpperCase() as Channel;
  const Model = MODELS[channel];
  const RecipientModel = RECIPIENT_MODELS[channel];
  if (!Model || !RecipientModel) return apiError("channel must be WHATSAPP, RCS, or EMAIL", 400);

  await connectDB();
  const campaign = await Model.findOne({ _id: campaignId, companyId: id });
  if (!campaign) return apiError("Not found", 404);
  if (campaign.status === "RUNNING") return apiError("Cannot delete a campaign that is currently running — cancel it first.", 400);

  await Promise.all([
    Model.deleteOne({ _id: campaignId, companyId: id }),
    RecipientModel.deleteMany({ campaignId, companyId: id }),
  ]);

  // Both of these are best-effort follow-ups to a mutation that has already
  // committed — neither should turn a successful delete into an error response.
  await logAdminAudit({
    companyId: id,
    userId: ctx.userId,
    action: "ADMIN_DELETE_CAMPAIGN",
    resource: `${channel.toLowerCase()}_campaign`,
    resourceId: campaignId,
    details: { name: campaign.name, channel, status: campaign.status },
  });
  await invalidateCachedJson(`campaign-stats:${id}`);

  return apiSuccess({ deleted: true });
}
