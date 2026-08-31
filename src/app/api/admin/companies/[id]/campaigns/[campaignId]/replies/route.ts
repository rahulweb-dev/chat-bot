import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { requireSuperAdminForCompany, isAdminContextError } from "@/lib/admin-helpers";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";
import WhatsAppConversation from "@/models/WhatsAppConversation";
import WhatsAppMessage from "@/models/WhatsAppMessage";

// Neither RCS nor Email capture inbound replies anywhere in this app (no
// RCSMessage/RCSConversation model exists, and the email webhook only tracks
// delivery/open/click events — there's no inbound-email pipeline at all). Rather
// than return an empty list that reads as "zero replies", this route says plainly
// that reply tracking isn't available for that channel.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  const { id, campaignId } = await params;
  const ctx = await requireSuperAdminForCompany(request, id);
  if (isAdminContextError(ctx)) return apiError(ctx.error, ctx.status);

  const { searchParams } = new URL(request.url);
  const channel = (searchParams.get("channel") || "").toUpperCase();

  if (channel === "RCS") {
    return apiSuccess({ available: false, reason: "This app doesn't capture inbound RCS replies — only delivery/read status is tracked via the Twilio webhook.", replies: [] });
  }
  if (channel === "EMAIL") {
    return apiSuccess({ available: false, reason: "This app has no inbound-email pipeline — only delivery/open/click events from the Resend webhook are tracked, not replies.", replies: [] });
  }
  if (channel !== "WHATSAPP") return apiError("channel must be WHATSAPP, RCS, or EMAIL", 400);

  await connectDB();

  // Cap to a sane number of recipients for this heuristic join — a company running
  // WhatsApp campaigns at a scale beyond this would need a real aggregation
  // pipeline, not a per-recipient reply lookup.
  const recipients = await WhatsAppCampaignRecipient.find({ campaignId, companyId: id })
    .populate("contactId", "name phone")
    .select("contactId phone sentAt status")
    .limit(500)
    .lean();

  const contactIds = recipients.map((r) => r.contactId?._id).filter(Boolean);
  if (!contactIds.length) return apiSuccess({ available: true, replies: [] });

  const conversations = await WhatsAppConversation.find({ companyId: id, contactId: { $in: contactIds } }).lean();
  const convByContact = new Map(conversations.map((c) => [String(c.contactId), c]));

  const conversationIds = conversations.map((c) => c._id);
  const inboundMessages = conversationIds.length
    ? await WhatsAppMessage.find({ companyId: id, conversationId: { $in: conversationIds }, direction: "INBOUND" }).sort({ createdAt: 1 }).lean()
    : [];
  const messagesByConversation = new Map<string, typeof inboundMessages>();
  for (const m of inboundMessages) {
    const key = String(m.conversationId);
    if (!messagesByConversation.has(key)) messagesByConversation.set(key, []);
    messagesByConversation.get(key)!.push(m);
  }

  const replies = recipients
    .map((r) => {
      const contact = r.contactId as unknown as { _id: string; name?: string } | null;
      if (!contact) return null;
      const conv = convByContact.get(String(contact._id));
      if (!conv) return null;
      const allMsgs = messagesByConversation.get(String(conv._id)) || [];
      // "Replied to this campaign" = any inbound message after this recipient's send.
      const sentAt = r.sentAt;
      const repliesAfterSend = sentAt ? allMsgs.filter((m) => new Date(m.createdAt) >= new Date(sentAt)) : allMsgs;
      if (!repliesAfterSend.length) return null;
      return {
        contactId: String(contact._id),
        name: contact.name || "Unknown",
        phone: r.phone,
        conversationId: String(conv._id),
        conversationStatus: conv.status,
        firstReplyAt: repliesAfterSend[0].createdAt,
        lastReplyAt: repliesAfterSend[repliesAfterSend.length - 1].createdAt,
        replyCount: repliesAfterSend.length,
        latestReplyText: repliesAfterSend[repliesAfterSend.length - 1].content || "(media message)",
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => new Date(b.lastReplyAt).getTime() - new Date(a.lastReplyAt).getTime());

  return apiSuccess({ available: true, replies });
}
