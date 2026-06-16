import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";

// "Sent" is cumulative: a recipient that has progressed to DELIVERED or READ
// was necessarily sent too, so it counts toward `sent` as well as its own bucket.
export async function recomputeCampaignStats(campaignId: string): Promise<void> {
  const [total, sent, delivered, read, failed, pending] = await Promise.all([
    WhatsAppCampaignRecipient.countDocuments({ campaignId }),
    WhatsAppCampaignRecipient.countDocuments({ campaignId, status: "SENT" }),
    WhatsAppCampaignRecipient.countDocuments({ campaignId, status: "DELIVERED" }),
    WhatsAppCampaignRecipient.countDocuments({ campaignId, status: "READ" }),
    WhatsAppCampaignRecipient.countDocuments({ campaignId, status: "FAILED" }),
    WhatsAppCampaignRecipient.countDocuments({ campaignId, status: { $in: ["PENDING", "QUEUED"] } }),
  ]);

  const update: Record<string, unknown> = {
    stats: { total, sent: sent + delivered + read, delivered, read, failed },
  };
  if (pending === 0 && total > 0) {
    update.status = failed === total ? "FAILED" : "COMPLETED";
    update.completedAt = new Date();
  }
  await WhatsAppCampaign.findByIdAndUpdate(campaignId, update);
}
