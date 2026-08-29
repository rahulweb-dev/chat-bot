import { Worker, Job } from "bullmq";
import { getRedisConnection } from "./connection";
import { RCS_SEND_QUEUE } from "./rcsQueue";
import { connectDB } from "@/lib/mongodb";
import { decrypt } from "@/lib/crypto";
import { sendRcsMessage } from "@/lib/twilioRcs";
import { recomputeRCSCampaignStats } from "@/lib/rcsCampaignStats";
import { checkUsageLimit, incrementUsage } from "@/lib/api-helpers";
import RCSCampaignRecipient from "@/models/RCSCampaignRecipient";
import RCSCampaign from "@/models/RCSCampaign";
import RCSContact from "@/models/RCSContact";
import RCSIntegration from "@/models/RCSIntegration";

const globalForWorker = globalThis as unknown as { __rcsWorker?: Worker };

function renderBody(body: string, contact: { name?: string }): string {
  return body.replace(/\{\{\s*name\s*\}\}/gi, contact.name || "there");
}

async function processRecipient(job: Job<{ recipientId: string }>) {
  await connectDB();
  const recipient = await RCSCampaignRecipient.findById(job.data.recipientId);
  if (!recipient || recipient.status !== "QUEUED") return;

  const campaign = await RCSCampaign.findById(recipient.campaignId);
  if (!campaign) return;

  const integration = await RCSIntegration.findOne({ companyId: recipient.companyId, enabled: true });
  if (!integration) {
    recipient.status = "FAILED";
    recipient.error = "RCS integration not connected";
    await recipient.save();
    await recomputeRCSCampaignStats(String(recipient.campaignId));
    return;
  }

  const contact = await RCSContact.findById(recipient.contactId);
  if (!contact || !contact.optIn) {
    recipient.status = "FAILED";
    recipient.error = "Contact is not opted in";
    await recipient.save();
    await recomputeRCSCampaignStats(String(recipient.campaignId));
    return;
  }

  const usage = await checkUsageLimit(String(recipient.companyId), "rcsSends");
  if (!usage.allowed) {
    recipient.status = "FAILED";
    recipient.error = usage.message || "Monthly RCS sending limit reached";
    await recipient.save();
    await recomputeRCSCampaignStats(String(recipient.campaignId));
    return; // don't retry — retrying won't fix a plan limit
  }

  const accountSid = decrypt(integration.encryptedAccountSid);
  const authToken = decrypt(integration.encryptedAuthToken);
  const body = renderBody(campaign.body, { name: contact.name });

  const result = await sendRcsMessage(accountSid, authToken, integration.messagingServiceSid, recipient.phone, body);

  if (!result.ok) {
    recipient.status = "FAILED";
    recipient.error = result.error;
    await recipient.save();
    await recomputeRCSCampaignStats(String(recipient.campaignId));
    throw new Error(result.error || "Send failed"); // let BullMQ retry per defaultJobOptions
  }

  await incrementUsage(String(recipient.companyId), "rcsSends");

  recipient.status = "SENT";
  recipient.twilioMessageSid = result.sid;
  recipient.sentAt = new Date();
  await recipient.save();

  await recomputeRCSCampaignStats(String(recipient.campaignId));
}

export function initRCSWorker(): Worker {
  if (globalForWorker.__rcsWorker) return globalForWorker.__rcsWorker;

  const worker = new Worker(RCS_SEND_QUEUE, processRecipient, {
    connection: getRedisConnection(),
    limiter: { max: 10, duration: 1000 },
    concurrency: 5,
  });

  worker.on("failed", (job, err) => {
    console.error(`[rcs-worker] job ${job?.id} failed:`, err.message);
  });

  let loggedWorkerRedisError = false;
  worker.on("error", (err) => {
    if (!loggedWorkerRedisError) {
      console.warn("[rcs-worker] redis connection error (will keep retrying quietly):", err.message);
      loggedWorkerRedisError = true;
    }
  });

  globalForWorker.__rcsWorker = worker;
  return worker;
}
