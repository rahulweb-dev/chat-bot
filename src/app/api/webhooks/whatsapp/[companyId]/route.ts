import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { decrypt } from "@/lib/crypto";
import { recomputeCampaignStats } from "@/lib/whatsappCampaignStats";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";
import WhatsAppContact from "@/models/WhatsAppContact";
import WhatsAppConversation from "@/models/WhatsAppConversation";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";
import { getIO } from "@/server/socket";

interface WAMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { caption?: string; id?: string };
  document?: { caption?: string; filename?: string; id?: string };
  audio?: { id?: string };
  video?: { caption?: string; id?: string };
}

interface WAStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipient_id: string;
  errors?: { title?: string }[];
}

type WAMessageType = "TEXT" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO";

function extractContent(msg: WAMessage): { messageType: WAMessageType; content: string; mediaId?: string } {
  switch (msg.type) {
    case "text":
      return { messageType: "TEXT", content: msg.text?.body || "" };
    case "image":
      return { messageType: "IMAGE", content: msg.image?.caption || "[image]", mediaId: msg.image?.id };
    case "document":
      return { messageType: "DOCUMENT", content: msg.document?.caption || msg.document?.filename || "[document]", mediaId: msg.document?.id };
    case "audio":
      return { messageType: "AUDIO", content: "[audio message]", mediaId: msg.audio?.id };
    case "video":
      return { messageType: "VIDEO", content: msg.video?.caption || "[video]", mediaId: msg.video?.id };
    default:
      return { messageType: "TEXT", content: "[unsupported message type]" };
  }
}

// Meta's webhook verification handshake
export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token) return new NextResponse("Forbidden", { status: 403 });

  await connectDB();
  const integration = await WhatsAppIntegration.findOne({ companyId });
  if (!integration) return new NextResponse("Forbidden", { status: 403 });

  const expected = decrypt(integration.encryptedWebhookVerifyToken);
  if (token !== expected) return new NextResponse("Forbidden", { status: 403 });

  return new NextResponse(challenge || "", { status: 200 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  await connectDB();

  const integration = await WhatsAppIntegration.findOne({ companyId, enabled: true });
  if (!integration) return NextResponse.json({ success: true }); // ack anyway, nothing to process

  const body = await request.json();
  const entries = body?.entry || [];

  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      const value = change?.value;
      if (!value) continue;

      // Defense in depth: ignore payloads for a different phone number than what's configured
      if (value.metadata?.phone_number_id && value.metadata.phone_number_id !== integration.phoneNumberId) continue;

      if (Array.isArray(value.messages) && value.messages.length) {
        const nameByWaId: Record<string, string> = {};
        for (const c of value.contacts || []) {
          if (c?.wa_id) nameByWaId[c.wa_id] = c?.profile?.name || "";
        }

        for (const msg of value.messages as WAMessage[]) {
          const { messageType, content, mediaId } = extractContent(msg);
          const customerName = nameByWaId[msg.from];

          const contact = await WhatsAppContact.findOneAndUpdate(
            { companyId, phone: msg.from },
            { $setOnInsert: { companyId, phone: msg.from }, ...(customerName ? { $set: { name: customerName } } : {}) },
            { upsert: true, new: true }
          );

          const conversation = await WhatsAppConversation.findOneAndUpdate(
            { companyId, customerPhone: msg.from },
            {
              $setOnInsert: { companyId, customerPhone: msg.from, contactId: contact._id },
              $set: {
                customerName: customerName || undefined,
                lastMessage: content,
                lastMessageAt: new Date(),
                status: "OPEN",
              },
              $inc: { unreadCount: 1 },
            },
            { upsert: true, new: true }
          );

          const message = await WhatsAppMessage.create({
            companyId,
            conversationId: conversation._id,
            direction: "INBOUND",
            messageType,
            content,
            mediaUrl: mediaId, // stores the WhatsApp media ID; resolved on demand via /api/whatsapp/media/[mediaId]
            whatsappMessageId: msg.id,
            status: "DELIVERED",
          }).catch(() => null); // unique index on whatsappMessageId guards webhook retries

          if (message) {
            getIO()?.to(`company:${companyId}`).emit("whatsapp:message:new", message);
            getIO()?.to(`company:${companyId}`).emit("whatsapp:conversation:updated", {
              conversationId: conversation._id,
              lastMessage: conversation.lastMessage,
              lastMessageAt: conversation.lastMessageAt,
            });
          }
        }
      }

      if (Array.isArray(value.statuses) && value.statuses.length) {
        for (const status of value.statuses as WAStatus[]) {
          const statusUpper = status.status.toUpperCase() as "SENT" | "DELIVERED" | "READ" | "FAILED";
          const now = new Date();
          const fieldForStatus: Record<string, string> = { DELIVERED: "deliveredAt", READ: "readAt" };

          const message = await WhatsAppMessage.findOneAndUpdate(
            { whatsappMessageId: status.id },
            {
              status: statusUpper,
              ...(fieldForStatus[statusUpper] ? { [fieldForStatus[statusUpper]]: now } : {}),
              ...(statusUpper === "FAILED" ? { failReason: status.errors?.[0]?.title } : {}),
            },
            { new: true }
          );

          const recipient = await WhatsAppCampaignRecipient.findOneAndUpdate(
            { whatsappMessageId: status.id },
            {
              status: statusUpper,
              ...(fieldForStatus[statusUpper] ? { [fieldForStatus[statusUpper]]: now } : {}),
              ...(statusUpper === "FAILED" ? { error: status.errors?.[0]?.title } : {}),
            },
            { new: true }
          );
          if (recipient) await recomputeCampaignStats(String(recipient.campaignId));

          if (message) {
            getIO()?.to(`company:${companyId}`).emit("whatsapp:status:update", {
              messageId: message._id,
              whatsappMessageId: status.id,
              status: statusUpper,
            });
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
