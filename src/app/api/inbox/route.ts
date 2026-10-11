import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { phoneKey } from "@/lib/phone";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import WhatsAppConversation from "@/models/WhatsAppConversation";

export interface InboxItem {
  key: string;              // "p:<phone>" for a known number, else "web:<id>" / "wa:<id>"
  name: string;
  phone?: string;
  channels: ("WEB" | "WHATSAPP")[];
  lastMessage?: string;
  lastMessageAt?: string;
  unread: number;
  waitingForAgent: boolean; // website visitor asked for a person and nobody's assigned
  status: string;
  webConversationId?: string; // most recent of each channel
  waConversationId?: string;
}

// One list for website chat and WhatsApp, one row per customer: conversations
// on both channels from the same phone number are merged.
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const sp = new URL(request.url).searchParams;
  const status = sp.get("status"); // "open" (default) | "all"
  const search = (sp.get("search") || "").trim().toLowerCase();
  const cid = new Types.ObjectId(ctx.companyId);

  const webFilter: Record<string, unknown> = { companyId: cid };
  const waFilter: Record<string, unknown> = { companyId: cid };
  if (status !== "all") {
    webFilter.status = { $in: ["OPEN", "ASSIGNED", "PENDING"] };
    waFilter.status = { $in: ["OPEN", "PENDING"] };
  }
  // Agents see what's assigned to them, plus unassigned chats waiting for someone.
  if (ctx.userRole === "AGENT") {
    webFilter.$or = [{ assignedTo: new Types.ObjectId(ctx.userId) }, { assignedTo: { $exists: false }, "metadata.needsAgent": true }];
    waFilter.$or = [{ assignedAgentId: new Types.ObjectId(ctx.userId) }, { assignedAgentId: { $exists: false } }];
  }

  const [web, wa] = await Promise.all([
    Conversation.find(webFilter).sort({ lastMessageAt: -1, createdAt: -1 }).limit(150)
      .select("visitor status assignedTo lastMessageAt createdAt metadata")
      .lean<{ _id: Types.ObjectId; visitor?: { name?: string; email?: string; phone?: string }; status: string; assignedTo?: unknown; lastMessageAt?: Date; createdAt: Date; metadata?: { needsAgent?: boolean } }[]>(),
    WhatsAppConversation.find(waFilter).sort({ lastMessageAt: -1 }).limit(150)
      .select("customerName customerPhone status lastMessage lastMessageAt unreadCount")
      .lean<{ _id: Types.ObjectId; customerName?: string; customerPhone: string; status: string; lastMessage?: string; lastMessageAt?: Date; unreadCount?: number }[]>(),
  ]);

  // Website conversations don't store their last message; fetch it in one query.
  const lastWeb = await Message.aggregate([
    { $match: { conversationId: { $in: web.map((c) => c._id) }, isNote: { $ne: true } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$conversationId", content: { $first: "$content" }, at: { $first: "$createdAt" } } },
  ]);
  const lastByConv = new Map(lastWeb.map((m: { _id: Types.ObjectId; content: string; at: Date }) => [String(m._id), m]));

  const items = new Map<string, InboxItem>();
  const touch = (key: string, base: Omit<InboxItem, "key" | "channels" | "unread" | "waitingForAgent"> & { channel: "WEB" | "WHATSAPP"; unread: number; waiting: boolean }) => {
    const cur = items.get(key);
    const newer = !cur || (base.lastMessageAt ?? "") > (cur.lastMessageAt ?? "");
    const next: InboxItem = cur ?? { key, name: base.name, phone: base.phone, channels: [], unread: 0, waitingForAgent: false, status: base.status };
    if (!next.channels.includes(base.channel)) next.channels.push(base.channel);
    next.unread += base.unread;
    next.waitingForAgent ||= base.waiting;
    if (newer) {
      next.lastMessage = base.lastMessage;
      next.lastMessageAt = base.lastMessageAt;
      next.status = base.status;
    }
    // Prefer a real name over a phone number / "Visitor".
    if ((!next.name || /^\+?\d[\d\s]+$/.test(next.name) || next.name === "Website visitor") && base.name && base.name !== "Website visitor") next.name = base.name;
    if (base.channel === "WEB" && !next.webConversationId) next.webConversationId = base.webConversationId;
    if (base.channel === "WHATSAPP" && !next.waConversationId) next.waConversationId = base.waConversationId;
    next.phone ||= base.phone;
    items.set(key, next);
  };

  for (const c of web) {
    const p = phoneKey(c.visitor?.phone);
    const last = lastByConv.get(String(c._id));
    touch(p ? `p:${p}` : `web:${c._id}`, {
      channel: "WEB",
      name: c.visitor?.name || c.visitor?.email || "Website visitor",
      phone: p ?? undefined,
      lastMessage: last?.content,
      lastMessageAt: (last?.at ?? c.lastMessageAt ?? c.createdAt)?.toISOString(),
      status: c.status,
      unread: 0,
      waiting: !!c.metadata?.needsAgent && !c.assignedTo,
      webConversationId: String(c._id),
    });
  }
  for (const c of wa) {
    const p = phoneKey(c.customerPhone);
    touch(p ? `p:${p}` : `wa:${c._id}`, {
      channel: "WHATSAPP",
      name: c.customerName || `+${c.customerPhone}`,
      phone: p ?? undefined,
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt?.toISOString(),
      status: c.status,
      unread: c.unreadCount ?? 0,
      waiting: false,
      waConversationId: String(c._id),
    });
  }

  let list = [...items.values()].sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  if (search) {
    list = list.filter((i) => i.name.toLowerCase().includes(search) || (i.phone ?? "").includes(search.replace(/\D/g, "") || "\u0000") || (i.lastMessage ?? "").toLowerCase().includes(search));
  }
  return apiSuccess(list.slice(0, 200));
}
