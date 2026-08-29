import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export const EMAIL_SEND_QUEUE = "email-campaign-send";

const globalForQueue = globalThis as unknown as { __emailQueue?: Queue };

export function getEmailSendQueue(): Queue {
  if (globalForQueue.__emailQueue) return globalForQueue.__emailQueue;

  const queue = new Queue(EMAIL_SEND_QUEUE, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    },
  });

  let loggedQueueRedisError = false;
  queue.on("error", (err) => {
    if (!loggedQueueRedisError) {
      console.warn("[email-queue] redis connection error (will keep retrying quietly):", err.message);
      loggedQueueRedisError = true;
    }
  });

  globalForQueue.__emailQueue = queue;
  return queue;
}

export async function enqueueEmailCampaignRecipients(recipientIds: string[]): Promise<void> {
  const queue = getEmailSendQueue();
  await queue.addBulk(
    recipientIds.map((recipientId) => ({
      name: "send-campaign-email",
      data: { recipientId },
      opts: { jobId: `email-recipient-${recipientId}` },
    }))
  );
}
