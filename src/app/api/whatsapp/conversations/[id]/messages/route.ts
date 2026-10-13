import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { sendText, sendTemplate, sendMedia, uploadMedia } from "@/lib/whatsapp";
import { checkMediaFile, mediaKindFor, normalizeMime } from "@/lib/whatsapp-media";
import { chargeForMessage, refundMessage } from "@/lib/whatsappWallet";
import WhatsAppConversation from "@/models/WhatsAppConversation";
import WhatsAppContact from "@/models/WhatsAppContact";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";
import { getIO } from "@/server/socket";
import { WHATSAPP_WINDOW_MS } from "@/lib/phone";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const conversation = await WhatsAppConversation.findOne({ _id: id, companyId: ctx.companyId });
  if (!conversation) return apiError("Not found", 404);

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "100");

  const messages = await WhatsAppMessage.find({ conversationId: id, companyId: ctx.companyId })
    .populate("senderId", "name avatar")
    .sort({ createdAt: 1 })
    .limit(limit);

  if (conversation.unreadCount > 0) {
    conversation.unreadCount = 0;
    await conversation.save();
  }

  return apiSuccess({ messages, total: messages.length });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const conversation = await WhatsAppConversation.findOne({ _id: id, companyId: ctx.companyId });
  if (!conversation) return apiError("Not found", 404);

  // JSON for text and templates; multipart/form-data when a file is attached.
  let content: string | undefined;
  let templateName: string | undefined;
  let templateLanguage: string | undefined;
  let templateBodyParams: unknown;
  let clientMessageId: string | undefined;
  let file: File | null = null;
  if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiError("The file couldn't be uploaded. It may be too large for the server.", 413);
    }
    const f = form.get("file");
    file = f instanceof File ? f : null;
    content = String(form.get("caption") || "").trim() || undefined;
    clientMessageId = String(form.get("clientMessageId") || "") || undefined;
  } else {
    const body = await request.json();
    ({ content, templateName, templateLanguage, templateBodyParams, clientMessageId } = body);
    content = typeof content === "string" ? content.trim() || undefined : undefined;
  }
  if (!content && !templateName && !file) return apiError("Message content, file or templateName required");
  if (clientMessageId && (typeof clientMessageId !== "string" || clientMessageId.length > 64)) clientMessageId = undefined;
  if (content && content.length > 4096) return apiError("WhatsApp messages can be up to 4096 characters.");

  const mediaKind = file ? mediaKindFor(file.type) : null;
  if (file) {
    const problem = checkMediaFile(file);
    if (problem) return apiError(problem, 415);
    if (content && content.length > 1024) return apiError("Captions can be up to 1024 characters.");
  }

  const integration = await WhatsAppIntegration.findOne({ companyId: ctx.companyId, enabled: true });
  if (!integration) return apiError("WhatsApp is not connected", 400);

  const accessToken = decrypt(integration.encryptedAccessToken);

  const isTemplate = !!templateName && !file;
  // Templates are business-initiated: never to someone who replied STOP.
  // (Plain replies inside the 24h window answer the customer's own message, so
  // they're still allowed.)
  if (isTemplate) {
    const contact = await WhatsAppContact.findOne(
      conversation.contactId ? { _id: conversation.contactId } : { companyId: ctx.companyId, phone: conversation.customerPhone }
    ).select("optIn").lean<{ optIn?: boolean }>();
    if (contact && contact.optIn === false) {
      return apiError("This customer opted out (replied STOP), so templates can't be sent to them. They can reply START to opt back in.", 422);
    }
  }
  // WhatsApp only delivers free-text messages within 24h of the customer's last
  // message; outside it Meta rejects them (after we'd have charged the wallet).
  // Conversations from before lastInboundAt was recorded are let through.
  if (!isTemplate && conversation.lastInboundAt && Date.now() - new Date(conversation.lastInboundAt).getTime() > WHATSAPP_WINDOW_MS) {
    return apiError("It's been more than 24 hours since this customer last messaged, so WhatsApp only allows an approved template. Send a template instead.", 422);
  }
  const components: Record<string, unknown>[] | undefined =
    isTemplate && Array.isArray(templateBodyParams) && templateBodyParams.length > 0
      ? [{ type: "body", parameters: templateBodyParams.map((text: string) => ({ type: "text", text })) }]
      : undefined;

  const messageType = isTemplate ? "TEMPLATE" : mediaKind ? (mediaKind.toUpperCase() as "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT") : "TEXT";
  const fileName = file && mediaKind === "document" ? file.name.slice(0, 200) : undefined;
  const displayContent = isTemplate ? `[Template: ${templateName}]` : content || "";
  const preview = isTemplate ? displayContent : content || (file ? `[${mediaKind === "document" ? fileName || "document" : mediaKind}]` : "");

  // Claim the send before charging or calling Meta. The unique
  // (companyId, clientMessageId) index makes a second click on Send — or a
  // retried request — find this record instead of sending the message again.
  let message;
  try {
    message = await WhatsAppMessage.create({
      companyId: ctx.companyId,
      conversationId: id,
      direction: "OUTBOUND",
      messageType,
      content: displayContent || undefined,
      fileName,
      templateName: isTemplate ? templateName : undefined,
      clientMessageId,
      status: "QUEUED",
      senderId: ctx.userId !== "api" ? ctx.userId : undefined,
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000 && clientMessageId) {
      const existing = await WhatsAppMessage.findOne({ companyId: ctx.companyId, clientMessageId }).populate("senderId", "name avatar");
      if (existing) return apiSuccess(existing, "Already sent");
    }
    throw e;
  }
  const abandon = () => WhatsAppMessage.deleteOne({ _id: message._id }).catch(() => {});

  const charge = await chargeForMessage(ctx.companyId);
  if (!charge.ok) {
    await abandon();
    return apiError(
      charge.reason === "daily_limit_reached" ? "Daily WhatsApp sending limit reached" : "Insufficient WhatsApp credits — add credits to continue sending",
      402
    );
  }

  let mediaId: string | undefined;
  let result: { ok: boolean; whatsappMessageId?: string; error?: string };
  if (file && mediaKind) {
    const upload = await uploadMedia(integration.phoneNumberId, accessToken, file, file.name || "file", normalizeMime(file.type));
    mediaId = upload.mediaId;
    result = upload.ok && mediaId
      ? await sendMedia(integration.phoneNumberId, accessToken, conversation.customerPhone, mediaKind, mediaId, { caption: content, filename: fileName })
      : { ok: false, error: upload.error || "Upload failed" };
  } else if (isTemplate) {
    result = await sendTemplate(integration.phoneNumberId, accessToken, conversation.customerPhone, templateName!, templateLanguage || "en_US", components);
  } else {
    result = await sendText(integration.phoneNumberId, accessToken, conversation.customerPhone, content!);
  }

  if (!result.ok) {
    await refundMessage(ctx.companyId);
    await abandon();
    return apiError(result.error || "Failed to send message");
  }

  message.set({ status: "SENT", whatsappMessageId: result.whatsappMessageId, mediaUrl: mediaId, sentAt: new Date() });
  await message.save();

  conversation.lastMessage = preview;
  conversation.lastMessageAt = new Date();
  await conversation.save();

  const populated = await message.populate("senderId", "name avatar");

  getIO()?.to(`company:${ctx.companyId}`).emit("whatsapp:message:new", populated);
  getIO()?.to(`company:${ctx.companyId}`).emit("whatsapp:conversation:updated", {
    conversationId: id,
    lastMessage: preview,
    lastMessageAt: conversation.lastMessageAt,
  });

  return apiSuccess(populated, "Message sent", 201);
}
