import EmailCampaign from "@/models/EmailCampaign";
import EmailCampaignRecipient from "@/models/EmailCampaignRecipient";

// Each metric is cumulative from the one before it (opened implies delivered implies sent),
// same convention as the WhatsApp campaign stats.
export async function recomputeEmailCampaignStats(campaignId: string): Promise<void> {
  const [total, sent, delivered, opened, clicked, bounced, failed, pending] = await Promise.all([
    EmailCampaignRecipient.countDocuments({ campaignId }),
    EmailCampaignRecipient.countDocuments({ campaignId, status: "SENT" }),
    EmailCampaignRecipient.countDocuments({ campaignId, status: "DELIVERED" }),
    EmailCampaignRecipient.countDocuments({ campaignId, status: "OPENED" }),
    EmailCampaignRecipient.countDocuments({ campaignId, status: "CLICKED" }),
    EmailCampaignRecipient.countDocuments({ campaignId, status: "BOUNCED" }),
    EmailCampaignRecipient.countDocuments({ campaignId, status: { $in: ["FAILED", "COMPLAINED"] } }),
    EmailCampaignRecipient.countDocuments({ campaignId, status: { $in: ["PENDING", "QUEUED"] } }),
  ]);

  const update: Record<string, unknown> = {
    stats: {
      total,
      sent: sent + delivered + opened + clicked,
      delivered: delivered + opened + clicked,
      opened: opened + clicked,
      clicked,
      bounced,
      failed,
    },
  };

  if (pending === 0 && total > 0) {
    const allFailed = failed === total;
    update.status = allFailed ? "FAILED" : "COMPLETED";
    update.completedAt = new Date();

    if (allFailed) {
      const firstFailed = await EmailCampaignRecipient.findOne({ campaignId, status: "FAILED", error: { $exists: true } }).select("error");
      if (firstFailed?.error) update.failureReason = firstFailed.error;
    }
  }

  await EmailCampaign.findByIdAndUpdate(campaignId, update);
}
