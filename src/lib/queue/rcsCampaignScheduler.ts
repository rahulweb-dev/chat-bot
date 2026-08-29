import cron from "node-cron";
import { connectDB } from "@/lib/mongodb";
import { decrypt } from "@/lib/crypto";
import { sendRcsMessage } from "@/lib/twilioRcs";
import { recomputeRCSCampaignStats } from "@/lib/rcsCampaignStats";
import { checkUsageLimit, incrementUsage } from "@/lib/api-helpers";
import RCSCampaign from "@/models/RCSCampaign";
import RCSContact from "@/models/RCSContact";
import RCSCampaignRecipient from "@/models/RCSCampaignRecipient";
import RCSIntegration from "@/models/RCSIntegration";
import { enqueueRCSCampaignRecipients } from "./rcsQueue";
import { isRedisAvailable } from "./connection";

const globalForScheduler = globalThis as unknown as { __rcsScheduler?: boolean };

function renderBody(body: string, contact: { name?: string }): string {
  return body.replace(/\{\{\s*name\s*\}\}/gi, contact.name || "there");
}

// Direct (non-queued) execution used when Redis is unavailable.
async function runCampaignDirect(campaignId: string): Promise<void> {
  const campaign = await RCSCampaign.findById(campaignId);
  if (!campaign) return;

  const integration = await RCSIntegration.findOne({ companyId: campaign.companyId, enabled: true });
  if (!integration) {
    campaign.status = "FAILED";
    campaign.failureReason = "RCS is not connected — go to Settings and connect first";
    campaign.completedAt = new Date();
    await campaign.save();
    return;
  }

  const contacts = await RCSContact.find({
    companyId: campaign.companyId,
    optIn: true,
    $or: [
      { _id: { $in: campaign.audienceContactIds } },
      { tags: { $in: campaign.audienceTags } },
    ],
  });

  if (contacts.length === 0) {
    campaign.status = "FAILED";
    campaign.failureReason = "No opted-in contacts matched the selected audience tags or contact list";
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

  const recipients = await RCSCampaignRecipient.insertMany(
    contacts.map((c) => ({
      campaignId: campaign._id,
      companyId: campaign.companyId,
      contactId: c._id,
      phone: c.phone,
      status: "QUEUED",
    }))
  );

  const accountSid = decrypt(integration.encryptedAccountSid);
  const authToken = decrypt(integration.encryptedAuthToken);

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const contact = contacts[i];

    const usage = await checkUsageLimit(String(campaign.companyId), "rcsSends");
    if (!usage.allowed) {
      await RCSCampaignRecipient.findByIdAndUpdate(recipient._id, {
        status: "FAILED",
        error: usage.message || "Monthly RCS sending limit reached",
      });
      continue;
    }

    const result = await sendRcsMessage(accountSid, authToken, integration.messagingServiceSid, contact.phone, renderBody(campaign.body, { name: contact.name }));

    if (!result.ok) {
      await RCSCampaignRecipient.findByIdAndUpdate(recipient._id, { status: "FAILED", error: result.error });
    } else {
      await incrementUsage(String(campaign.companyId), "rcsSends");
      await RCSCampaignRecipient.findByIdAndUpdate(recipient._id, {
        status: "SENT",
        twilioMessageSid: result.sid,
        sentAt: new Date(),
      });
    }
  }

  campaign.status = "COMPLETED";
  campaign.completedAt = new Date();
  await campaign.save();
  await recomputeRCSCampaignStats(campaignId);
}

export async function startRCSCampaign(campaignId: string): Promise<void> {
  const campaign = await RCSCampaign.findById(campaignId);
  if (!campaign) return;

  if (!(await isRedisAvailable())) {
    console.log(`[rcs-campaign-scheduler] Redis unavailable — running campaign ${campaignId} directly`);
    await runCampaignDirect(campaignId);
    return;
  }

  const integration = await RCSIntegration.findOne({ companyId: campaign.companyId, enabled: true });
  if (!integration) {
    campaign.status = "FAILED";
    campaign.failureReason = "RCS is not connected — go to Settings and connect first";
    campaign.completedAt = new Date();
    await campaign.save();
    return;
  }

  const contacts = await RCSContact.find({
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

  const recipients = await RCSCampaignRecipient.insertMany(
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

  await enqueueRCSCampaignRecipients(recipients.map((r) => String(r._id)));
}

export function initRCSCampaignScheduler(): void {
  if (globalForScheduler.__rcsScheduler) return;
  globalForScheduler.__rcsScheduler = true;

  cron.schedule("* * * * *", async () => {
    try {
      await connectDB();
      const due = await RCSCampaign.find({ status: "SCHEDULED", scheduledAt: { $lte: new Date() } });
      for (const campaign of due) {
        await startRCSCampaign(String(campaign._id));
      }
    } catch (e) {
      console.error("[rcs-campaign-scheduler] tick failed:", e);
    }
  });
}
