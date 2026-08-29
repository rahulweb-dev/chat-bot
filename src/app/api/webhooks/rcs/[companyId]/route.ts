import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { decrypt } from "@/lib/crypto";
import { verifyTwilioSignature, parseTwilioFormBody, sendRcsMessage } from "@/lib/twilioRcs";
import { recomputeRCSCampaignStats } from "@/lib/rcsCampaignStats";
import RCSIntegration from "@/models/RCSIntegration";
import RCSContact from "@/models/RCSContact";
import RCSCampaignRecipient from "@/models/RCSCampaignRecipient";

const STOP_KEYWORDS = new Set(["stop", "unsubscribe", "optout", "opt out", "cancel", "remove me"]);
const START_KEYWORDS = new Set(["start", "subscribe", "unstop", "resume"]);

function classifyOptKeyword(text: string): "STOP" | "START" | null {
  const normalized = text.trim().toLowerCase();
  if (STOP_KEYWORDS.has(normalized)) return "STOP";
  if (START_KEYWORDS.has(normalized)) return "START";
  return null;
}

const STATUS_MAP: Record<string, string> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
  undelivered: "UNDELIVERED",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  await connectDB();

  const integration = await RCSIntegration.findOne({ companyId, enabled: true });
  if (!integration) return NextResponse.json({ success: true }); // ack anyway, nothing to process

  const rawBody = await request.text();
  const parsedParams = parseTwilioFormBody(rawBody);

  // Reconstruct the canonical URL Twilio signed against — must match what's registered
  // in the Twilio Console exactly, not whatever a reverse proxy rewrote the request to.
  const canonicalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/rcs/${companyId}`;
  const authToken = decrypt(integration.encryptedAuthToken);

  if (!verifyTwilioSignature(canonicalUrl, parsedParams, request.headers.get("x-twilio-signature"), authToken)) {
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
  }

  // Status callback: has MessageStatus. Inbound message: has Body, no MessageStatus.
  if (parsedParams.MessageStatus) {
    const newStatus = STATUS_MAP[parsedParams.MessageStatus.toLowerCase()];
    if (!newStatus) return NextResponse.json({ success: true });

    const RANK: Record<string, number> = { SENT: 0, DELIVERED: 1, READ: 2, FAILED: 0, UNDELIVERED: 0 };
    const recipient = await RCSCampaignRecipient.findOne({ twilioMessageSid: parsedParams.MessageSid });
    if (recipient && RANK[newStatus] >= (RANK[recipient.status] ?? 0)) {
      const dateField = newStatus === "DELIVERED" ? "deliveredAt" : newStatus === "READ" ? "readAt" : undefined;
      await RCSCampaignRecipient.findByIdAndUpdate(recipient._id, {
        status: newStatus,
        ...(dateField ? { [dateField]: new Date() } : {}),
        ...(newStatus === "FAILED" || newStatus === "UNDELIVERED" ? { error: parsedParams.ErrorMessage || `Twilio error ${parsedParams.ErrorCode || ""}`.trim() } : {}),
      });
      await recomputeRCSCampaignStats(String(recipient.campaignId));
    }
    return NextResponse.json({ success: true });
  }

  if (parsedParams.Body && parsedParams.From) {
    const from = parsedParams.From.replace(/[^\d+]/g, "");
    const optKeyword = classifyOptKeyword(parsedParams.Body);

    if (optKeyword) {
      const contact = await RCSContact.findOneAndUpdate(
        { companyId, phone: from },
        { $setOnInsert: { companyId, phone: from } },
        { upsert: true, new: true }
      );

      if (optKeyword === "STOP" && contact.optIn) {
        await RCSContact.updateOne({ _id: contact._id }, { optIn: false, optOutAt: new Date() });
        sendRcsMessage(decrypt(integration.encryptedAccountSid), authToken, integration.messagingServiceSid, from, "You've been unsubscribed and won't receive further messages from us. Reply START to resubscribe.").catch(() => {});
      } else if (optKeyword === "START" && !contact.optIn) {
        await RCSContact.updateOne({ _id: contact._id }, { optIn: true, optInAt: new Date() });
        sendRcsMessage(decrypt(integration.encryptedAccountSid), authToken, integration.messagingServiceSid, from, "You're resubscribed. Reply STOP anytime to opt out.").catch(() => {});
      }
    }
  }

  return NextResponse.json({ success: true });
}
