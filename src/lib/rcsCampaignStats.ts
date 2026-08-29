import RCSCampaign from "@/models/RCSCampaign";
import RCSCampaignRecipient from "@/models/RCSCampaignRecipient";

export async function recomputeRCSCampaignStats(campaignId: string): Promise<void> {
  const [total, sent, delivered, read, failed, pending] = await Promise.all([
    RCSCampaignRecipient.countDocuments({ campaignId }),
    RCSCampaignRecipient.countDocuments({ campaignId, status: "SENT" }),
    RCSCampaignRecipient.countDocuments({ campaignId, status: "DELIVERED" }),
    RCSCampaignRecipient.countDocuments({ campaignId, status: "READ" }),
    RCSCampaignRecipient.countDocuments({ campaignId, status: { $in: ["FAILED", "UNDELIVERED"] } }),
    RCSCampaignRecipient.countDocuments({ campaignId, status: { $in: ["PENDING", "QUEUED"] } }),
  ]);

  const update: Record<string, unknown> = {
    stats: { total, sent: sent + delivered + read, delivered: delivered + read, read, failed },
  };

  if (pending === 0 && total > 0) {
    const allFailed = failed === total;
    update.status = allFailed ? "FAILED" : "COMPLETED";
    update.completedAt = new Date();

    if (allFailed) {
      const firstFailed = await RCSCampaignRecipient.findOne({ campaignId, status: { $in: ["FAILED", "UNDELIVERED"] }, error: { $exists: true } }).select("error");
      if (firstFailed?.error) update.failureReason = firstFailed.error;
    }
  }

  await RCSCampaign.findByIdAndUpdate(campaignId, update);
}
