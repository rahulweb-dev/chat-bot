import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export const WHATSAPP_SEND_QUEUE = "whatsapp-send";

const globalForQueue = globalThis as unknown as { __whatsappQueue?: Queue };

export function getWhatsAppSendQueue(): Queue {
  if (globalForQueue.__whatsappQueue) return globalForQueue.__whatsappQueue;

  const queue = new Queue(WHATSAPP_SEND_QUEUE, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    },
  });

  // Same reasoning as the worker: BullMQ's internally-duplicated connection
  // doesn't inherit the error listener on the original IORedis instance.
  let loggedQueueRedisError = false;
  queue.on("error", (err) => {
    if (!loggedQueueRedisError) {
      console.warn("[whatsapp-queue] redis connection error (will keep retrying quietly):", err.message);
      loggedQueueRedisError = true;
    }
  });

  globalForQueue.__whatsappQueue = queue;
  return queue;
}

export async function enqueueCampaignRecipients(recipientIds: string[]): Promise<void> {
  const queue = getWhatsAppSendQueue();
  await queue.addBulk(
    recipientIds.map((recipientId) => ({
      name: "send-campaign-message",
      data: { recipientId },
      opts: { jobId: `recipient-${recipientId}` },
    }))
  );
}
