import { Worker, Job } from "bullmq";
import { getRedisConnection } from "./connection";
import { WHATSAPP_SEND_QUEUE } from "./whatsappQueue";
import { connectDB } from "@/lib/mongodb";
import { decrypt } from "@/lib/crypto";
import { sendTemplate, buildTemplateComponents } from "@/lib/whatsapp";
import { recomputeCampaignStats } from "@/lib/whatsappCampaignStats";
import { chargeForMessage, refundMessage } from "@/lib/whatsappWallet";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";
import WhatsAppConversation from "@/models/WhatsAppConversation";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import { getIO } from "@/server/socket";

const globalForWorker = globalThis as unknown as { __whatsappWorker?: Worker };

async function processRecipient(job: Job<{ recipientId: string }>) {
  await connectDB();
  const recipient = await WhatsAppCampaignRecipient.findById(job.data.recipientId);
  if (!recipient || recipient.status !== "QUEUED") return;

  const campaign = await WhatsAppCampaign.findById(recipient.campaignId);
  if (!campaign) return;

  const integration = await WhatsAppIntegration.findOne({ companyId: recipient.companyId, enabled: true });
  if (!integration || !campaign.templateName) {
    recipient.status = "FAILED";
    recipient.error = !integration ? "WhatsApp integration not connected" : "Campaign has no template selected";
    await recipient.save();
    await recomputeCampaignStats(String(recipient.campaignId));
    return;
  }

  const charge = await chargeForMessage(String(recipient.companyId));
  if (!charge.ok) {
    recipient.status = "FAILED";
    recipient.error = charge.reason === "daily_limit_reached" ? "Daily WhatsApp sending limit reached" : "Insufficient WhatsApp credits";
    await recipient.save();
    await recomputeCampaignStats(String(recipient.campaignId));
    return; // don't retry — retrying won't fix an empty wallet
  }

  const accessToken = decrypt(integration.encryptedAccessToken);
  const components = buildTemplateComponents({
    offerImageUrl: campaign.offerImageUrl,
    variables: campaign.variables,
    ctaType: campaign.ctaType,
    ctaUrl: campaign.ctaUrl,
  });
  const result = await sendTemplate(
    integration.phoneNumberId,
    accessToken,
    recipient.phone,
    campaign.templateName,
    campaign.templateLanguage,
    components
  );

  if (!result.ok) {
    await refundMessage(String(recipient.companyId));
    recipient.status = "FAILED";
    recipient.error = result.error;
    await recipient.save();
    await recomputeCampaignStats(String(recipient.campaignId));
    throw new Error(result.error || "Send failed"); // let BullMQ retry per defaultJobOptions
  }

  recipient.status = "SENT";
  recipient.whatsappMessageId = result.whatsappMessageId;
  recipient.sentAt = new Date();
  await recipient.save();

  // Mirror into the conversation/message timeline so campaign sends show up in the inbox too
  const conversation = await WhatsAppConversation.findOneAndUpdate(
    { companyId: recipient.companyId, customerPhone: recipient.phone },
    {
      $setOnInsert: { companyId: recipient.companyId, customerPhone: recipient.phone, contactId: recipient.contactId, status: "OPEN" },
      $set: { lastMessage: `[Campaign] ${campaign.name}`, lastMessageAt: new Date() },
    },
    { upsert: true, new: true }
  );

  await WhatsAppMessage.create({
    companyId: recipient.companyId,
    conversationId: conversation._id,
    direction: "OUTBOUND",
    messageType: "TEMPLATE",
    templateName: campaign.templateName,
    whatsappMessageId: result.whatsappMessageId,
    status: "SENT",
    sentAt: new Date(),
  }).catch(() => {}); // whatsappMessageId unique index guards against duplicate retries

  getIO()?.to(`company:${recipient.companyId}`).emit("whatsapp:conversation:updated", {
    conversationId: conversation._id,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
  });

  await recomputeCampaignStats(String(recipient.campaignId));
}

export function initWhatsAppWorker(): Worker {
  if (globalForWorker.__whatsappWorker) return globalForWorker.__whatsappWorker;

  const worker = new Worker(WHATSAPP_SEND_QUEUE, processRecipient, {
    connection: getRedisConnection(),
    limiter: { max: 10, duration: 1000 }, // conservative default; respects WhatsApp throughput tiers
    concurrency: 5,
  });

  worker.on("failed", (job, err) => {
    console.error(`[whatsapp-worker] job ${job?.id} failed:`, err.message);
  });

  // BullMQ duplicates the connection internally for blocking commands; that
  // duplicate doesn't inherit listeners from the original IORedis instance,
  // so without this it logs raw "Unhandled error event" / AggregateError
  // dumps on every retry whenever Redis isn't reachable.
  let loggedWorkerRedisError = false;
  worker.on("error", (err) => {
    if (!loggedWorkerRedisError) {
      console.warn("[whatsapp-worker] redis connection error (will keep retrying quietly):", err.message);
      loggedWorkerRedisError = true;
    }
  });

  globalForWorker.__whatsappWorker = worker;
  return worker;
}
