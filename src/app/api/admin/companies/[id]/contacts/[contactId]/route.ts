import { NextRequest } from "next/server";
import { Model as MongooseModel } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { requireSuperAdminForCompany, isAdminContextError } from "@/lib/admin-helpers";
import WhatsAppContact from "@/models/WhatsAppContact";
import RCSContact from "@/models/RCSContact";
import EmailContact from "@/models/EmailContact";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";
import RCSCampaignRecipient from "@/models/RCSCampaignRecipient";
import EmailCampaignRecipient from "@/models/EmailCampaignRecipient";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import RCSCampaign from "@/models/RCSCampaign";
import EmailCampaign from "@/models/EmailCampaign";
import WhatsAppConversation from "@/models/WhatsAppConversation";
import WhatsAppMessage from "@/models/WhatsAppMessage";

type Channel = "WHATSAPP" | "RCS" | "EMAIL";

/* eslint-disable @typescript-eslint/no-explicit-any */
const CONTACT_MODELS: Record<string, MongooseModel<any>> = { WHATSAPP: WhatsAppContact, RCS: RCSContact, EMAIL: EmailContact };
const RECIPIENT_MODELS: Record<string, MongooseModel<any>> = { WHATSAPP: WhatsAppCampaignRecipient, RCS: RCSCampaignRecipient, EMAIL: EmailCampaignRecipient };
const CAMPAIGN_MODELS: Record<string, MongooseModel<any>> = { WHATSAPP: WhatsAppCampaign, RCS: RCSCampaign, EMAIL: EmailCampaign };
/* eslint-enable @typescript-eslint/no-explicit-any */

// The "click a recipient, see their full history" drill-through the spec asked
// for: this contact's info, every campaign they've ever been sent on this
// channel, and — WhatsApp only, since it's the one channel with real inbound
// message capture — their conversation thread if one exists.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; contactId: string }> }) {
  const { id, contactId } = await params;
  const ctx = await requireSuperAdminForCompany(request, id);
  if (isAdminContextError(ctx)) return apiError(ctx.error, ctx.status);

  const { searchParams } = new URL(request.url);
  const channel = (searchParams.get("channel") || "").toUpperCase() as Channel;
  const ContactModel = CONTACT_MODELS[channel];
  const RecipientModel = RECIPIENT_MODELS[channel];
  const CampaignModel = CAMPAIGN_MODELS[channel];
  if (!ContactModel) return apiError("channel must be WHATSAPP, RCS, or EMAIL", 400);

  await connectDB();
  const contact = await ContactModel.findOne({ _id: contactId, companyId: id }).lean();
  if (!contact) return apiError("Not found", 404);

  const recipientRows = await RecipientModel.find({ contactId, companyId: id }).sort({ createdAt: -1 }).limit(100).lean();
  const campaignIds = [...new Set(recipientRows.map((r) => String(r.campaignId)))];
  const campaigns = campaignIds.length ? await CampaignModel.find({ _id: { $in: campaignIds } }).select("name").lean() : [];
  const nameById = new Map(campaigns.map((c) => [String(c._id), c.name]));

  const campaignHistory = recipientRows.map((r) => ({
    campaignId: String(r.campaignId),
    campaignName: nameById.get(String(r.campaignId)) || "—",
    status: r.status,
    sentAt: r.sentAt,
    deliveredAt: r.deliveredAt,
    readAt: r.readAt,
    openedAt: r.openedAt,
    clickedAt: r.clickedAt,
    error: r.error,
  }));

  let conversation: { conversationId: string; status: string; lastMessageAt?: Date; messages: Array<{ direction: string; content?: string; messageType: string; createdAt: Date }> } | null = null;

  if (channel === "WHATSAPP") {
    const conv = await WhatsAppConversation.findOne({ companyId: id, contactId }).lean();
    if (conv) {
      const messages = await WhatsAppMessage.find({ conversationId: conv._id }).sort({ createdAt: -1 }).limit(30).lean();
      conversation = {
        conversationId: String(conv._id),
        status: conv.status,
        lastMessageAt: conv.lastMessageAt,
        messages: messages.reverse().map((m) => ({ direction: m.direction, content: m.content, messageType: m.messageType, createdAt: m.createdAt })),
      };
    }
  }

  return apiSuccess({ contact, channel, campaignHistory, conversation });
}
