import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { verifyResendSignature } from "@/lib/resend";
import { recomputeEmailCampaignStats } from "@/lib/emailCampaignStats";
import EmailCampaignRecipient from "@/models/EmailCampaignRecipient";
import EmailContact from "@/models/EmailContact";

interface ResendWebhookPayload {
  type: string;
  data: {
    email_id: string;
    bounce?: { type?: string };
  };
}

const STATUS_BY_EVENT: Record<string, string> = {
  "email.delivered": "DELIVERED",
  "email.opened": "OPENED",
  "email.clicked": "CLICKED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
};

const DATE_FIELD_BY_EVENT: Record<string, string> = {
  "email.delivered": "deliveredAt",
  "email.opened": "openedAt",
  "email.clicked": "clickedAt",
  "email.bounced": "bouncedAt",
};

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[email-webhook] RESEND_WEBHOOK_SECRET not configured — rejecting");
    return NextResponse.json({ success: false, error: "Webhook not configured" }, { status: 401 });
  }

  const rawBody = await request.text();
  const verified = verifyResendSignature(rawBody, {
    svixId: request.headers.get("svix-id"),
    svixTimestamp: request.headers.get("svix-timestamp"),
    svixSignature: request.headers.get("svix-signature"),
  }, webhookSecret);

  if (!verified) return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });

  const payload: ResendWebhookPayload = JSON.parse(rawBody);
  const newStatus = STATUS_BY_EVENT[payload.type];
  if (!newStatus) return NextResponse.json({ success: true }); // event type we don't track (e.g. email.sent, delayed)

  await connectDB();

  // Statuses only ever move forward (SENT -> DELIVERED -> OPENED -> CLICKED); a late
  // "delivered" webhook arriving after we already recorded "opened" shouldn't regress it.
  const RANK: Record<string, number> = { SENT: 0, DELIVERED: 1, OPENED: 2, CLICKED: 3, BOUNCED: 1, COMPLAINED: 1, FAILED: 0 };
  const recipient = await EmailCampaignRecipient.findOne({ resendMessageId: payload.data.email_id });
  if (!recipient) return NextResponse.json({ success: true });

  if (RANK[newStatus] >= (RANK[recipient.status] ?? 0)) {
    const dateField = DATE_FIELD_BY_EVENT[payload.type];
    await EmailCampaignRecipient.findByIdAndUpdate(recipient._id, {
      status: newStatus,
      ...(dateField ? { [dateField]: new Date() } : {}),
    });
  }

  if (newStatus === "BOUNCED" || newStatus === "COMPLAINED") {
    // A hard bounce or spam complaint should stop future sends to this address —
    // ESPs (including Resend) penalize sender reputation for repeated bounces.
    await EmailContact.findByIdAndUpdate(recipient.contactId, {
      optIn: false,
      optOutAt: new Date(),
      ...(newStatus === "BOUNCED" ? { bounced: true } : {}),
    });
  }

  await recomputeEmailCampaignStats(String(recipient.campaignId));

  return NextResponse.json({ success: true });
}
