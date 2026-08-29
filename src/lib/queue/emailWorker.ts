import { Worker, Job } from "bullmq";
import { getRedisConnection } from "./connection";
import { EMAIL_SEND_QUEUE } from "./emailQueue";
import { connectDB } from "@/lib/mongodb";
import { sendCampaignEmail } from "@/lib/resend";
import { renderCampaignEmail } from "@/lib/emailCampaignRender";
import { recomputeEmailCampaignStats } from "@/lib/emailCampaignStats";
import { checkUsageLimit, incrementUsage } from "@/lib/api-helpers";
import EmailCampaignRecipient from "@/models/EmailCampaignRecipient";
import EmailCampaign from "@/models/EmailCampaign";
import EmailContact from "@/models/EmailContact";

const globalForWorker = globalThis as unknown as { __emailWorker?: Worker };

function unsubscribeUrl(token: string): string {
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${base}/api/email/unsubscribe?token=${token}`;
}

async function processRecipient(job: Job<{ recipientId: string }>) {
  await connectDB();
  const recipient = await EmailCampaignRecipient.findById(job.data.recipientId);
  if (!recipient || recipient.status !== "QUEUED") return;

  const campaign = await EmailCampaign.findById(recipient.campaignId);
  if (!campaign) return;

  const contact = await EmailContact.findById(recipient.contactId);
  if (!contact || !contact.optIn) {
    recipient.status = "FAILED";
    recipient.error = "Contact is not opted in";
    await recipient.save();
    await recomputeEmailCampaignStats(String(recipient.campaignId));
    return;
  }

  const usage = await checkUsageLimit(String(recipient.companyId), "emailSends");
  if (!usage.allowed) {
    recipient.status = "FAILED";
    recipient.error = usage.message || "Monthly email sending limit reached";
    await recipient.save();
    await recomputeEmailCampaignStats(String(recipient.campaignId));
    return; // don't retry — retrying won't fix a plan limit
  }

  const html = renderCampaignEmail(campaign.html, { name: contact.name, email: contact.email }, unsubscribeUrl(contact.unsubscribeToken));

  const result = await sendCampaignEmail({
    to: recipient.email,
    subject: campaign.subject,
    html,
    fromName: campaign.fromName,
    tags: [{ name: "campaign_id", value: String(campaign._id) }, { name: "recipient_id", value: String(recipient._id) }],
  });

  if (!result.ok) {
    recipient.status = "FAILED";
    recipient.error = result.error;
    await recipient.save();
    await recomputeEmailCampaignStats(String(recipient.campaignId));
    throw new Error(result.error || "Send failed"); // let BullMQ retry per defaultJobOptions
  }

  await incrementUsage(String(recipient.companyId), "emailSends");

  recipient.status = "SENT";
  recipient.resendMessageId = result.id;
  recipient.sentAt = new Date();
  await recipient.save();

  await recomputeEmailCampaignStats(String(recipient.campaignId));
}

export function initEmailWorker(): Worker {
  if (globalForWorker.__emailWorker) return globalForWorker.__emailWorker;

  const worker = new Worker(EMAIL_SEND_QUEUE, processRecipient, {
    connection: getRedisConnection(),
    limiter: { max: 10, duration: 1000 },
    concurrency: 5,
  });

  worker.on("failed", (job, err) => {
    console.error(`[email-worker] job ${job?.id} failed:`, err.message);
  });

  let loggedWorkerRedisError = false;
  worker.on("error", (err) => {
    if (!loggedWorkerRedisError) {
      console.warn("[email-worker] redis connection error (will keep retrying quietly):", err.message);
      loggedWorkerRedisError = true;
    }
  });

  globalForWorker.__emailWorker = worker;
  return worker;
}
