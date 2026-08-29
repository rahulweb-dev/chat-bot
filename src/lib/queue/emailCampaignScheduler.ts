import cron from "node-cron";
import { connectDB } from "@/lib/mongodb";
import { sendCampaignEmail } from "@/lib/resend";
import { renderCampaignEmail } from "@/lib/emailCampaignRender";
import { recomputeEmailCampaignStats } from "@/lib/emailCampaignStats";
import { checkUsageLimit, incrementUsage } from "@/lib/api-helpers";
import EmailCampaign from "@/models/EmailCampaign";
import EmailContact from "@/models/EmailContact";
import EmailCampaignRecipient from "@/models/EmailCampaignRecipient";
import { enqueueEmailCampaignRecipients } from "./emailQueue";
import { isRedisAvailable } from "./connection";

const globalForScheduler = globalThis as unknown as { __emailScheduler?: boolean };

function unsubscribeUrl(token: string): string {
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${base}/api/email/unsubscribe?token=${token}`;
}

// Direct (non-queued) execution used when Redis is unavailable.
// Processes recipients sequentially in-process — fine for demo/dev volumes.
async function runCampaignDirect(campaignId: string): Promise<void> {
  const campaign = await EmailCampaign.findById(campaignId);
  if (!campaign) return;

  const contacts = await EmailContact.find({
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

  const recipients = await EmailCampaignRecipient.insertMany(
    contacts.map((c) => ({
      campaignId: campaign._id,
      companyId: campaign.companyId,
      contactId: c._id,
      email: c.email,
      status: "QUEUED",
    }))
  );

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const contact = contacts[i];

    const usage = await checkUsageLimit(String(campaign.companyId), "emailSends");
    if (!usage.allowed) {
      await EmailCampaignRecipient.findByIdAndUpdate(recipient._id, {
        status: "FAILED",
        error: usage.message || "Monthly email sending limit reached",
      });
      continue;
    }

    const html = renderCampaignEmail(campaign.html, { name: contact.name, email: contact.email }, unsubscribeUrl(contact.unsubscribeToken));
    const result = await sendCampaignEmail({
      to: contact.email,
      subject: campaign.subject,
      html,
      fromName: campaign.fromName,
      tags: [{ name: "campaign_id", value: String(campaign._id) }, { name: "recipient_id", value: String(recipient._id) }],
    });

    if (!result.ok) {
      await EmailCampaignRecipient.findByIdAndUpdate(recipient._id, { status: "FAILED", error: result.error });
    } else {
      await incrementUsage(String(campaign.companyId), "emailSends");
      await EmailCampaignRecipient.findByIdAndUpdate(recipient._id, {
        status: "SENT",
        resendMessageId: result.id,
        sentAt: new Date(),
      });
    }
  }

  campaign.status = "COMPLETED";
  campaign.completedAt = new Date();
  await campaign.save();
  await recomputeEmailCampaignStats(campaignId);
}

export async function startEmailCampaign(campaignId: string): Promise<void> {
  const campaign = await EmailCampaign.findById(campaignId);
  if (!campaign) return;

  if (!(await isRedisAvailable())) {
    console.log(`[email-campaign-scheduler] Redis unavailable — running campaign ${campaignId} directly`);
    await runCampaignDirect(campaignId);
    return;
  }

  const contacts = await EmailContact.find({
    companyId: campaign.companyId,
    optIn: true,
    $or: [
      { _id: { $in: campaign.audienceContactIds } },
      { tags: { $in: campaign.audienceTags } },
    ],
  }).select("_id email");

  if (contacts.length === 0) {
    campaign.status = "FAILED";
    campaign.failureReason = "No opted-in contacts matched the selected audience tags or contact list";
    campaign.completedAt = new Date();
    await campaign.save();
    return;
  }

  const recipients = await EmailCampaignRecipient.insertMany(
    contacts.map((c) => ({
      campaignId: campaign._id,
      companyId: campaign.companyId,
      contactId: c._id,
      email: c.email,
      status: "QUEUED",
    }))
  );

  campaign.status = "RUNNING";
  campaign.startedAt = new Date();
  campaign.stats.total = recipients.length;
  await campaign.save();

  await enqueueEmailCampaignRecipients(recipients.map((r) => String(r._id)));
}

export function initEmailCampaignScheduler(): void {
  if (globalForScheduler.__emailScheduler) return;
  globalForScheduler.__emailScheduler = true;

  cron.schedule("* * * * *", async () => {
    try {
      await connectDB();
      const due = await EmailCampaign.find({ status: "SCHEDULED", scheduledAt: { $lte: new Date() } });
      for (const campaign of due) {
        await startEmailCampaign(String(campaign._id));
      }
    } catch (e) {
      console.error("[email-campaign-scheduler] tick failed:", e);
    }
  });
}
