import cron from "node-cron";
import { connectDB } from "@/lib/mongodb";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import WhatsAppContact from "@/models/WhatsAppContact";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";
import { enqueueCampaignRecipients } from "./whatsappQueue";
import { isRedisAvailable } from "./connection";

const globalForScheduler = globalThis as unknown as { __whatsappScheduler?: boolean };

export async function startCampaign(campaignId: string): Promise<void> {
  const campaign = await WhatsAppCampaign.findById(campaignId);
  if (!campaign) return;

  if (!(await isRedisAvailable())) {
    campaign.status = "FAILED";
    campaign.completedAt = new Date();
    await campaign.save();
    return;
  }

  const contacts = await WhatsAppContact.find({
    companyId: campaign.companyId,
    optIn: true, // hard requirement: never send to non-opted-in contacts
    $or: [
      { _id: { $in: campaign.audienceContactIds } },
      { tags: { $in: campaign.audienceTags } },
    ],
  }).select("_id phone");

  if (contacts.length === 0) {
    campaign.status = "FAILED";
    campaign.completedAt = new Date();
    await campaign.save();
    return;
  }

  const recipients = await WhatsAppCampaignRecipient.insertMany(
    contacts.map((c) => ({
      campaignId: campaign._id,
      companyId: campaign.companyId,
      contactId: c._id,
      phone: c.phone,
      status: "QUEUED",
    }))
  );

  campaign.status = "RUNNING";
  campaign.startedAt = new Date();
  campaign.stats.total = recipients.length;
  await campaign.save();

  await enqueueCampaignRecipients(recipients.map((r) => String(r._id)));
}

export function initCampaignScheduler(): void {
  if (globalForScheduler.__whatsappScheduler) return;
  globalForScheduler.__whatsappScheduler = true;

  cron.schedule("* * * * *", async () => {
    try {
      await connectDB();
      const due = await WhatsAppCampaign.find({ status: "SCHEDULED", scheduledAt: { $lte: new Date() } });
      for (const campaign of due) {
        await startCampaign(String(campaign._id));
      }
    } catch (e) {
      console.error("[whatsapp-scheduler] tick failed:", e);
    }
  });
}
