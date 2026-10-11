import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { phoneVariants, WHATSAPP_WINDOW_MS } from "@/lib/phone";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import WhatsAppConversation from "@/models/WhatsAppConversation";
import WhatsAppMessage from "@/models/WhatsAppMessage";

export interface ThreadMessage {
  id: string;
  channel: "WEB" | "WHATSAPP";
  from: "customer" | "team" | "bot" | "system";
  content: string;
  at: string;
  senderName?: string;
  mediaId?: string;
  messageType?: string;
  status?: string;
}

// The whole history with one customer across website chat and WhatsApp.
// ?key=p:<phone> | web:<conversationId> | wa:<conversationId>
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  const key = new URL(request.url).searchParams.get("key") || "";
  const [kind, value] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (!value || !["p", "web", "wa"].includes(kind)) return apiError("Unknown conversation", 400);
  if ((kind === "web" || kind === "wa") && !Types.ObjectId.isValid(value)) return apiError("Unknown conversation", 400);

  await connectDB();
  const cid = new Types.ObjectId(ctx.companyId);
  const variants = kind === "p" ? phoneVariants(value) : [];

  const [webConvs, waConvs] = await Promise.all([
    kind === "wa" ? [] : Conversation.find(kind === "p" ? { companyId: cid, "visitor.phone": { $in: variants } } : { companyId: cid, _id: value })
      .sort({ createdAt: -1 }).limit(20)
      .select("visitor status assignedTo createdAt metadata attribution")
      .populate("assignedTo", "name")
      .lean<{ _id: Types.ObjectId; visitor?: { name?: string; email?: string; phone?: string; currentPage?: string; attribution?: { channel?: string } }; status: string; assignedTo?: { _id: Types.ObjectId; name?: string }; createdAt: Date; metadata?: { needsAgent?: boolean } }[]>(),
    kind === "web" ? [] : WhatsAppConversation.find(kind === "p" ? { companyId: cid, customerPhone: { $in: variants } } : { companyId: cid, _id: value })
      .sort({ lastMessageAt: -1 }).limit(5)
      .select("customerName customerPhone status lastInboundAt assignedAgentId")
      .lean<{ _id: Types.ObjectId; customerName?: string; customerPhone: string; status: string; lastInboundAt?: Date; assignedAgentId?: Types.ObjectId }[]>(),
  ]);
  if (!webConvs.length && !waConvs.length) return apiError("Conversation not found", 404);

  // Agents may only open chats assigned to them or still unassigned.
  if (ctx.userRole === "AGENT") {
    const mine = (id?: unknown) => !id || String((id as { _id?: unknown })._id ?? id) === ctx.userId;
    if (!webConvs.some((c) => mine(c.assignedTo)) && !waConvs.some((c) => mine(c.assignedAgentId))) return apiError("Forbidden", 403);
  }

  const [webMsgs, waMsgs] = await Promise.all([
    webConvs.length
      ? Message.find({ conversationId: { $in: webConvs.map((c) => c._id) }, isNote: { $ne: true } }).sort({ createdAt: -1 }).limit(300)
          .populate("senderId", "name").lean<{ _id: Types.ObjectId; senderType: string; content: string; createdAt: Date; senderId?: { name?: string } }[]>()
      : [],
    waConvs.length
      ? WhatsAppMessage.find({ conversationId: { $in: waConvs.map((c) => c._id) } }).sort({ createdAt: -1 }).limit(300)
          .lean<{ _id: Types.ObjectId; direction: string; content?: string; messageType: string; mediaUrl?: string; templateName?: string; status: string; createdAt: Date }[]>()
      : [],
  ]);

  const messages: ThreadMessage[] = [
    ...webMsgs.map((m) => ({
      id: String(m._id), channel: "WEB" as const,
      from: (m.senderType === "VISITOR" ? "customer" : m.senderType === "AGENT" ? "team" : m.senderType === "BOT" ? "bot" : "system") as ThreadMessage["from"],
      content: m.content, at: m.createdAt.toISOString(), senderName: m.senderId?.name,
    })),
    ...waMsgs.map((m) => ({
      id: String(m._id), channel: "WHATSAPP" as const,
      from: (m.direction === "INBOUND" ? "customer" : "team") as ThreadMessage["from"],
      content: m.content || (m.templateName ? `Template: ${m.templateName}` : `[${m.messageType.toLowerCase()}]`),
      at: m.createdAt.toISOString(), mediaId: m.mediaUrl, messageType: m.messageType, status: m.status,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  // Opening the thread marks WhatsApp messages as read, like the WhatsApp inbox does.
  if (waConvs.length) await WhatsAppConversation.updateMany({ _id: { $in: waConvs.map((c) => c._id) } }, { unreadCount: 0 });

  const web = webConvs[0];
  const wa = waConvs[0];
  return apiSuccess({
    name: web?.visitor?.name || wa?.customerName || (wa ? `+${wa.customerPhone}` : "Website visitor"),
    phone: web?.visitor?.phone || (wa ? `+${wa.customerPhone}` : undefined),
    email: web?.visitor?.email,
    source: web?.visitor?.attribution?.channel,
    currentPage: web?.visitor?.currentPage,
    web: web ? { conversationId: String(web._id), status: web.status, assignedTo: web.assignedTo?.name, waitingForAgent: !!web.metadata?.needsAgent && !web.assignedTo } : null,
    whatsapp: wa ? {
      conversationId: String(wa._id), status: wa.status,
      // Free-text replies only inside the 24h window; null = unknown (older chat), allowed.
      windowOpen: wa.lastInboundAt ? Date.now() - new Date(wa.lastInboundAt).getTime() < WHATSAPP_WINDOW_MS : null,
      windowClosesAt: wa.lastInboundAt ? new Date(new Date(wa.lastInboundAt).getTime() + WHATSAPP_WINDOW_MS).toISOString() : null,
    } : null,
    messages,
  });
}
