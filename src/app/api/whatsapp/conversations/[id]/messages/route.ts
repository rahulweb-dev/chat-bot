import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { sendText, sendTemplate } from "@/lib/whatsapp";
import { chargeForMessage, refundMessage } from "@/lib/whatsappWallet";
import WhatsAppConversation from "@/models/WhatsAppConversation";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";
import { getIO } from "@/server/socket";

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

  const body = await request.json();
  const { content, templateName, templateLanguage, templateBodyParams } = body;
  if (!content && !templateName) return apiError("Message content or templateName required");

  const integration = await WhatsAppIntegration.findOne({ companyId: ctx.companyId, enabled: true });
  if (!integration) return apiError("WhatsApp is not connected", 400);

  const accessToken = decrypt(integration.encryptedAccessToken);

  const isTemplate = !!templateName;
  const components: Record<string, unknown>[] | undefined =
    isTemplate && Array.isArray(templateBodyParams) && templateBodyParams.length > 0
      ? [{ type: "body", parameters: templateBodyParams.map((text: string) => ({ type: "text", text })) }]
      : undefined;

  const charge = await chargeForMessage(ctx.companyId);
  if (!charge.ok) {
    return apiError(
      charge.reason === "daily_limit_reached" ? "Daily WhatsApp sending limit reached" : "Insufficient WhatsApp credits — add credits to continue sending",
      402
    );
  }

  const result = isTemplate
    ? await sendTemplate(integration.phoneNumberId, accessToken, conversation.customerPhone, templateName, templateLanguage || "en_US", components)
    : await sendText(integration.phoneNumberId, accessToken, conversation.customerPhone, content);

  if (!result.ok) {
    await refundMessage(ctx.companyId);
    return apiError(result.error || "Failed to send message");
  }

  const displayContent = isTemplate ? `[Template: ${templateName}]` : content;

  const message = await WhatsAppMessage.create({
    companyId: ctx.companyId,
    conversationId: id,
    direction: "OUTBOUND",
    messageType: isTemplate ? "TEMPLATE" : "TEXT",
    content: displayContent,
    templateName: isTemplate ? templateName : undefined,
    whatsappMessageId: result.whatsappMessageId,
    status: "SENT",
    senderId: ctx.userId !== "api" ? ctx.userId : undefined,
    sentAt: new Date(),
  });

  conversation.lastMessage = displayContent;
  conversation.lastMessageAt = new Date();
  await conversation.save();

  const populated = await message.populate("senderId", "name avatar");

  getIO()?.to(`company:${ctx.companyId}`).emit("whatsapp:message:new", populated);
  getIO()?.to(`company:${ctx.companyId}`).emit("whatsapp:conversation:updated", {
    conversationId: id,
    lastMessage: displayContent,
    lastMessageAt: conversation.lastMessageAt,
  });

  return apiSuccess(populated, "Message sent", 201);
}
