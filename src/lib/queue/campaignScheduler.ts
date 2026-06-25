import cron from "node-cron";
import { connectDB } from "@/lib/mongodb";
import { decrypt } from "@/lib/crypto";
import { sendTemplate, buildTemplateComponents } from "@/lib/whatsapp";
import { chargeForMessage, refundMessage } from "@/lib/whatsappWallet";
import { recomputeCampaignStats } from "@/lib/whatsappCampaignStats";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import WhatsAppContact from "@/models/WhatsAppContact";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";
import { enqueueCampaignRecipients } from "./whatsappQueue";
import { isRedisAvailable } from "./connection";

const globalForScheduler = globalThis as unknown as { __whatsappScheduler?: boolean };

// Direct (non-queued) execution used when Redis is unavailable.
// Processes recipients sequentially in-process — fine for demo/dev volumes.
async function runCampaignDirect(campaignId: string): Promise<void> {
  const campaign = await WhatsAppCampaign.findById(campaignId);
  if (!campaign) return;

  const contacts = await WhatsAppContact.find({
    companyId: campaign.companyId,
    optIn: true,
    $or: [
      { _id: { $in: campaign.audienceContactIds } },
      { tags: { $in: campaign.audienceTags } },
    ],
  }).select("_id phone");

  if (contacts.length === 0) {
    campaign.status = "FAILED";
    campaign.failureReason = "No opted-in contacts matched the selected audience tags or contact list";
    campaign.completedAt = new Date();
    await campaign.save();
    return;
  }

  const integration = await WhatsAppIntegration.findOne({ companyId: campaign.companyId, enabled: true });
  if (!integration || !campaign.templateName) {
    campaign.status = "FAILED";
    campaign.failureReason = !integration
      ? "WhatsApp integration not connected — go to Settings and connect first"
      : "Campaign has no template selected";
    campaign.completedAt = new Date();
    await campaign.save();
    return;
  }

  campaign.status = "RUNNING";
  campaign.startedAt = new Date();
  campaign.stats.total = contacts.length;
  campaign.stats.sent = 0;
  campaign.stats.failed = 0;
  await campaign.save();

  const accessToken = decrypt(integration.encryptedAccessToken);
  const components = buildTemplateComponents({
    offerImageUrl: campaign.offerImageUrl,
    variables: campaign.variables,
    ctaType: campaign.ctaType,
    ctaUrl: campaign.ctaUrl,
  });

  // Insert recipient records so stats/inbox work the same as the queued path
  const recipients = await WhatsAppCampaignRecipient.insertMany(
    contacts.map((c) => ({
      campaignId: campaign._id,
      companyId: campaign.companyId,
      contactId: c._id,
      phone: c.phone,
      status: "QUEUED",
    }))
  );

  for (const recipient of recipients) {
    const charge = await chargeForMessage(String(campaign.companyId));
    if (!charge.ok) {
      await WhatsAppCampaignRecipient.findByIdAndUpdate(recipient._id, {
        status: "FAILED",
        error: charge.reason === "daily_limit_reached"
          ? "Daily WhatsApp sending limit reached"
          : "Insufficient WhatsApp credits",
      });
      continue;
    }

    const result = await sendTemplate(
      integration.phoneNumberId,
      accessToken,
      recipient.phone,
      campaign.templateName!,
      campaign.templateLanguage,
      components
    );

    if (!result.ok) {
      await refundMessage(String(campaign.companyId));
      await WhatsAppCampaignRecipient.findByIdAndUpdate(recipient._id, {
        status: "FAILED",
        error: result.error,
      });
    } else {
      await WhatsAppCampaignRecipient.findByIdAndUpdate(recipient._id, {
        status: "SENT",
        whatsappMessageId: result.whatsappMessageId,
        sentAt: new Date(),
      });
    }
  }

  campaign.status = "COMPLETED";
  campaign.completedAt = new Date();
  await campaign.save();
  await recomputeCampaignStats(campaignId);
}

export async function startCampaign(campaignId: string): Promise<void> {
  const campaign = await WhatsAppCampaign.findById(campaignId);
  if (!campaign) return;

  // Fallback to direct execution when Redis isn't available (dev / demo environments).
  if (!(await isRedisAvailable())) {
    console.log(`[campaign-scheduler] Redis unavailable — running campaign ${campaignId} directly`);
    await runCampaignDirect(campaignId);
    return;
  }

  const contacts = await WhatsAppContact.find({
    companyId: campaign.companyId,
    optIn: true,
    $or: [
      { _id: { $in: campaign.audienceContactIds } },
      { tags: { $in: campaign.audienceTags } },
    ],
  }).select("_id phone");

  if (contacts.length === 0) {
    campaign.status = "FAILED";
    campaign.failureReason = "No opted-in contacts matched the selected audience tags or contact list";
    campaign.completedAt = new Date();
    await campaign.save();
    return;
  }

  const recipients = await WhatsAppCampaignRecipient.insertMany(
    contacts.map((c) => ({
      campaignId: campaign._id,
      companyId: campaign.companyId,
      contactId: c._id,
      phone: c.phone,
      status: "QUEUED",
    }))
  );

  campaign.status = "RUNNING";
  campaign.startedAt = new Date();
  campaign.stats.total = recipients.length;
  await campaign.save();

  await enqueueCampaignRecipients(recipients.map((r) => String(r._id)));
}

export function initCampaignScheduler(): void {
  if (globalForScheduler.__whatsappScheduler) return;
  globalForScheduler.__whatsappScheduler = true;

  cron.schedule("* * * * *", async () => {
    try {
      await connectDB();
      const due = await WhatsAppCampaign.find({ status: "SCHEDULED", scheduledAt: { $lte: new Date() } });
      for (const campaign of due) {
        await startCampaign(String(campaign._id));
      }
    } catch (e) {
      console.error("[whatsapp-scheduler] tick failed:", e);
    }
  });
}
