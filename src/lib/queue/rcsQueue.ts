import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export const RCS_SEND_QUEUE = "rcs-campaign-send";

const globalForQueue = globalThis as unknown as { __rcsQueue?: Queue };

export function getRCSSendQueue(): Queue {
  if (globalForQueue.__rcsQueue) return globalForQueue.__rcsQueue;

  const queue = new Queue(RCS_SEND_QUEUE, {
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
      console.warn("[rcs-queue] redis connection error (will keep retrying quietly):", err.message);
      loggedQueueRedisError = true;
    }
  });

  globalForQueue.__rcsQueue = queue;
  return queue;
}

export async function enqueueRCSCampaignRecipients(recipientIds: string[]): Promise<void> {
  const queue = getRCSSendQueue();
  await queue.addBulk(
    recipientIds.map((recipientId) => ({
      name: "send-rcs-campaign-message",
      data: { recipientId },
      opts: { jobId: `rcs-recipient-${recipientId}` },
    }))
  );
}
