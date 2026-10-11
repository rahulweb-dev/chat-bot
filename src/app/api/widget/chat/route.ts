import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getBotReply, SessionData } from "@/lib/chatbot-flow";
import Company from "@/models/Company";
import ApiKey from "@/models/ApiKey";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import Lead from "@/models/Lead";
import Ticket from "@/models/Ticket";
import Settings from "@/models/Settings";
import { getIO } from "@/server/socket";
import { triggerChat } from "@/lib/pusher";
import { rateLimit, rateLimitError } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import User from "@/models/User";
import { nextTicketNumber } from "@/lib/ticket-number";
import { sendWhatsAppLeadAlert } from "@/lib/lead-alerts";
import { sendPushToCompany, sendPushToUsers } from "@/lib/push";
import { releaseSlot } from "@/lib/booking";
import { createCalendarEvent } from "@/lib/google-calendar";
import Booking from "@/models/Booking";
import { checkUsageLimit, incrementUsage } from "@/lib/api-helpers";
import type { Attribution } from "@/lib/attribution";
import type { Types } from "mongoose";

async function resolveCompany(apiKey: string) {
  let company = await Company.findOne({ apiKey, isActive: true });
  if (company) return company;
  const keyDoc = await ApiKey.findOne({ key: apiKey, isActive: true });
  if (keyDoc) {
    company = await Company.findOne({ _id: keyDoc.companyId, isActive: true });
    if (company) {
      ApiKey.findByIdAndUpdate(keyDoc._id, { lastUsedAt: new Date(), $inc: { requestCount: 1 } }).catch(() => {});
      return company;
    }
  }
  return null;
}

function emitNotification(companyId: string, data: Record<string, unknown>) {
  // getIO() returns undefined on serverless (Vercel) where the custom server never ran.
  getIO()?.to(`company:${companyId}`).emit("notification:new", data);
  // Same event as a phone/desktop push, so it reaches the team with the dashboard closed.
  const type = String(data.type ?? "");
  sendPushToCompany(companyId, {
    title: type === "agent_request" ? "🙋 Visitor wants a person" : type === "ticket" ? "🎫 New ticket" : "🎯 New lead",
    body: String(data.message ?? ""),
    url: type === "agent_request" ? "/dashboard/chat" : type === "ticket" ? "/dashboard/tickets" : String(data.message ?? "").includes("booked") ? "/dashboard/bookings" : "/dashboard/leads",
    tag: data.conversationId ? `conv-${data.conversationId}-${type}` : undefined,
  }).catch(() => {});
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

export async function POST(request: NextRequest) {
  // Rate limit: 30 messages per minute per IP, 120 per minute per API key
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const ipOk  = await rateLimit(`widget:ip:${ip}`,  30, 60_000);
  if (!ipOk)  return rateLimitError();

  const body = await request.json();
  const { apiKey, conversationId, message, sessionData, lang } = body;

  if (!apiKey || !message) {
    return NextResponse.json({ success: false, error: "apiKey and message required" }, { status: 400, headers: CORS });
  }

  const keyOk = await rateLimit(`widget:key:${apiKey}`, 120, 60_000);
  if (!keyOk) return rateLimitError();

  if (typeof message !== "string" || message.length > 2000) {
    return NextResponse.json({ success: false, error: "Message too long (max 2000 chars)" }, { status: 400, headers: CORS });
  }

  await connectDB();
  const company = await resolveCompany(apiKey);
  if (!company) return NextResponse.json({ success: false, error: "Invalid API key" }, { status: 401, headers: CORS });

  const companyId = company._id.toString();

  // Chats are counted when the conversation starts (/api/widget start_conversation),
  // which refuses once the plan's monthly limit is hit. Without a conversation the
  // bot would still answer unsaved, so apply the same limit here too.
  if (!conversationId) {
    const quota = await checkUsageLimit(companyId, "chats").catch(() => null);
    if (quota && !quota.allowed) {
      return NextResponse.json({ success: false, error: "LIMIT_REACHED" }, { status: 402, headers: CORS });
    }
  }

  // If a live agent is handling this conversation, skip the bot entirely
  if (conversationId && message !== "__INIT__") {
    const conv = await Conversation.findOne({ _id: conversationId, companyId }).select("assignedTo metadata").lean() as { assignedTo?: unknown; metadata?: { needsAgent?: boolean } } | null;
    if (conv?.assignedTo || conv?.metadata?.needsAgent) {
      await Message.create({ companyId, conversationId, senderType: "VISITOR", type: "TEXT", content: message, isDelivered: true }).catch(() => {});
      await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date(), $inc: { messageCount: 1 } }).catch(() => {});
      // Emit real-time for agent dashboard
      const msg = await Message.findOne({ conversationId, content: message, senderType: "VISITOR" }).sort({ createdAt: -1 });
      getIO()?.to(`conversation:${conversationId}`).emit("message:new", msg);
      getIO()?.to(`company:${companyId}`).emit("conversation:updated", { conversationId, lastMessage: message, lastMessageAt: new Date() });
      // The assigned agent gets the message on their phone too (one notification per chat, replaced as new messages arrive).
      if (conv.assignedTo) sendPushToUsers([String(conv.assignedTo)], { title: "💬 New message", body: message.slice(0, 140), url: "/dashboard/chat", tag: `conv-${conversationId}` }).catch(() => {});
      const session: SessionData = sessionData?.flow ? sessionData : { flow: "INITIAL", step: "", collected: {} };
      return NextResponse.json({ success: true, data: { messages: [], quickReplies: [], action: "NONE", sideEffect: {}, sessionData: session } }, { headers: CORS });
    }
  }

  const session: SessionData = sessionData?.flow ? sessionData : { flow: "INITIAL", step: "", collected: {} };

  // Training/FAQs → this company's own custom menu flow (if enabled) → the built-in demo flow
  const companySettings = await Settings.findOne({ companyId }).select("widget.welcomeMessage general.timezone").lean() as { widget?: { welcomeMessage?: string }; general?: { timezone?: string } } | null;
  const result = await getBotReply(message, session, companyId, companySettings?.widget?.welcomeMessage, companySettings?.general?.timezone, { lang: typeof lang === "string" ? lang : undefined });

  // Real IDs of the bot messages just saved below — sent back so the widget can mark
  // them as already-rendered before its Pusher subscription echoes the same messages
  // back (triggerChat broadcasts every one), which otherwise renders each one twice.
  const botMessageIds: string[] = [];

  if (conversationId) {
    if (message !== "__INIT__") {
      const visitorMsg = await Message.create({ companyId, conversationId, senderType: "VISITOR", type: "TEXT", content: message, isDelivered: true }).catch(() => null);
      // Push visitor message to admin dashboard in real-time
      if (visitorMsg) {
        const io = getIO();
        if (io) {
          // Deliberately emitted to BOTH rooms: the conversation room is what
          // ChatWindow listens on to render the thread, and the company room
          // is what lets an agent who DOESN'T have this conversation open get
          // an unread badge/notification for it (live-chat.tsx checks
          // message.conversationId !== activeConversationId). An agent who
          // DOES have this exact conversation open is in both rooms and gets
          // both events — chat-store's addMessage dedupes by _id so that
          // doesn't render twice (see chat-store.ts).
          io.to(`conversation:${conversationId}`).emit("message:new", visitorMsg);
          io.to(`company:${companyId}`).emit("message:new", { ...visitorMsg.toObject(), conversationId });
          io.to(`company:${companyId}`).emit("conversation:updated", { conversationId, lastMessage: message, lastMessageAt: new Date() });
        }
      }
    }
    for (const msg of result.messages) {
      const saved = await Message.create({ companyId, conversationId, senderType: "BOT", type: "TEXT", content: msg, isDelivered: true }).catch(() => null);
      if (saved) {
        botMessageIds.push(saved._id.toString());
        triggerChat(conversationId, {
          id: saved._id.toString(),
          content: msg,
          senderType: "BOT",
          senderName: null,
          createdAt: saved.createdAt,
        });
      }
    }

    // Update visitor name/phone in the conversation when the IDENTIFY flow collects them
    const collected = result.sessionData.collected;
    const visitorUpdate: Record<string, string> = {};
    if (collected.name) visitorUpdate["visitor.name"] = collected.name;
    if (collected.phone) visitorUpdate["visitor.phone"] = collected.phone;

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageAt: new Date(),
      $inc: { messageCount: result.messages.length + 1 },
      ...(Object.keys(visitorUpdate).length ? visitorUpdate : {}),
    }).catch(() => {});
  }

  let sideEffect: Record<string, unknown> = {};
  const ld = result.leadData;
  const td = result.ticketData;
  // Lead source recorded on the conversation when it started (widget.js).
  const attributionFor = async () =>
    (await Conversation.findById(conversationId).select("visitor.attribution").lean<{ visitor?: { attribution?: Attribution } }>())?.visitor?.attribution;

  if (result.action === "CREATE_LEAD" && ld && conversationId) {
    try {
      const existing = await Lead.findOne({ companyId, conversationId });
      if (!existing) {
        const lead = await Lead.create({
          companyId, conversationId,
          name: ld.name || "Widget Visitor", phone: ld.phone, email: ld.email,
          source: "CHAT_WIDGET", stage: "NEW", score: Number(ld.score) || 50,
          currency: "INR", tags: [ld.type || "GENERAL", "AUTO_DEALERSHIP"],
          customFields: ld,
          attribution: await attributionFor(),
          activities: [{ type: "CHAT", description: `Widget lead: ${ld.type}`, createdAt: new Date() }],
        });
        sideEffect = { type: "lead_created", leadId: lead._id };
        // Bookings send their own, richer alert below.
        if (!result.booking) sendWhatsAppLeadAlert(companyId, { kind: "lead", name: ld.name, phone: ld.phone, interest: ld.type, source: lead.attribution?.channel }).catch(() => {});
        // Counted but never blocked: dropping a captured lead loses the customer's sale.
        incrementUsage(companyId, "leads").catch(() => {});
        // Tag the conversation with the lead intent so it shows in sidebar
        const leadTag = ld.type || "GENERAL";
        await Conversation.findByIdAndUpdate(conversationId, {
          $addToSet: { tags: { $each: [leadTag, "AUTO_DEALERSHIP"] } },
          leadId: lead._id,
        }).catch(() => {});
        emitNotification(companyId, {
          type: "lead",
          conversationId,
          message: `New lead from ${ld.name || "Visitor"}`,
          name: ld.name || "Visitor",
        });
        // Email the company admin about the new lead
        User.findOne({ companyId, role: "COMPANY_ADMIN" }).select("email name").then(admin => {
          if (!admin?.email) return;
          sendEmail({
            to: admin.email,
            subject: `🎯 New lead captured: ${ld.name || "Visitor"}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h2 style="color:#6366f1;margin-top:0">New Lead Captured!</h2>
              <table style="border-collapse:collapse;width:100%;font-size:14px">
                <tr><td style="padding:8px 0;color:#6b7280;width:120px">Name</td><td style="font-weight:600">${ld.name || "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280">Phone</td><td>${ld.phone || "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280">Type</td><td>${ld.type || "GENERAL"}</td></tr>
              </table>
              <a href="${process.env.AUTH_URL}/dashboard/leads"
                 style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:20px;font-weight:600">
                View Lead →
              </a>
            </div>`,
          }).catch(() => {});
        }).catch(() => {});
      }
    } catch (e) { console.error("Lead:", e); }
  }

  // A slot the visitor just booked (src/lib/booking-flow.ts): save it, link it to
  // the lead, and alert the team. Without a conversation there's nothing to tie
  // it to, so the held place is given back.
  if (result.booking) {
    const b = result.booking;
    if (!conversationId) {
      if (b.held) releaseSlot(companyId, new Date(b.startAt)).catch(() => {});
    } else {
      try {
        const lead = await Lead.findOne({ companyId, conversationId }).sort({ createdAt: -1 }).select("_id attribution").lean<{ _id: Types.ObjectId; attribution?: Attribution }>();
        const booking = await Booking.create({
          companyId, conversationId, leadId: lead?._id, label: b.label,
          name: ld?.name || "Visitor", phone: ld?.phone, email: ld?.email,
          startAt: new Date(b.startAt), endAt: new Date(b.endAt),
          attribution: lead?.attribution ?? (await attributionFor()),
        });
        sideEffect = { type: "booking_created", bookingId: booking._id, leadId: lead?._id };
        // Put it in the company's Google Calendar, if connected (no-op otherwise).
        createCalendarEvent(companyId, {
          title: `${b.label[0].toUpperCase()}${b.label.slice(1)}: ${booking.name}`,
          description: [
            "Booked via website chat.",
            `Phone: ${booking.phone ?? "-"}`,
            lead?.attribution?.channel ? `Source: ${lead.attribution.channel}` : "",
          ].filter(Boolean).join("\n"),
          start: booking.startAt, end: booking.endAt,
        }).then(async (id) => { if (id) await Booking.updateOne({ _id: booking._id }, { googleEventId: id }); }).catch(() => {});
        await Conversation.findByIdAndUpdate(conversationId, { $addToSet: { tags: "BOOKING" } }).catch(() => {});
        emitNotification(companyId, { type: "lead", conversationId, message: `New ${b.label} booked by ${ld?.name || "Visitor"} for ${ld?.bookingAt ?? b.startAt}`, name: ld?.name || "Visitor" });
        sendWhatsAppLeadAlert(companyId, {
          kind: "lead", name: ld?.name, phone: ld?.phone,
          interest: `${b.label} on ${ld?.bookingAt ?? new Date(b.startAt).toISOString()}`,
          source: lead?.attribution?.channel,
        }).catch(() => {});
      } catch (e) {
        console.error("Booking:", e);
        if (b.held) releaseSlot(companyId, new Date(b.startAt)).catch(() => {});
      }
    }
  }

  if (result.action === "CREATE_TICKET" && td && conversationId) {
    try {
      const ticket = await Ticket.create({
        companyId, conversationId,
        ticketNumber: await nextTicketNumber(companyId),
        subject: td.subject, description: td.description,
        status: "OPEN", priority: "NORMAL", category: "SERVICE", tags: ["WIDGET"],
        requester: { name: ld?.name || "Visitor", email: ld?.email || "visitor@widget.com", phone: ld?.phone || "" },
        // Preserve every collected field, not just vehicleNumber/serviceType — those
        // were specific to the hardcoded SERVICE flow; custom flows collect arbitrary
        // fields (and a "type" marker) that would otherwise be silently dropped here.
        customFields: (() => { const { subject: _s, description: _d, ...rest } = td; return rest; })(),
      });
      incrementUsage(companyId, "tickets").catch(() => {});
      if (ld?.phone) {
        const lead = await Lead.create({ companyId, conversationId, name: ld.name || "Visitor", phone: ld.phone, source: "CHAT_WIDGET", stage: "NEW", score: 50, currency: "INR", tags: ["SERVICE", "AUTO_DEALERSHIP"], attribution: await attributionFor() }).catch(() => null);
        if (lead) {
          incrementUsage(companyId, "leads").catch(() => {});
          sendWhatsAppLeadAlert(companyId, { kind: "lead", name: ld.name, phone: ld.phone, interest: td.subject, source: lead.attribution?.channel }).catch(() => {});
        }
      }
      sideEffect = { type: "ticket_created", ticketId: ticket._id, ticketNumber: ticket.ticketNumber };
      await Conversation.findByIdAndUpdate(conversationId, {
        $addToSet: { tags: { $each: ["SERVICE", "WIDGET"] } },
        ticketId: ticket._id,
      }).catch(() => {});
      emitNotification(companyId, {
        type: "ticket",
        conversationId,
        message: `New service ticket: ${td.subject || "Service request"}`,
        name: ld?.name || "Visitor",
      });
      User.findOne({ companyId, role: "COMPANY_ADMIN" }).select("email name").then(admin => {
        if (!admin?.email) return;
        sendEmail({
          to: admin.email,
          subject: `🎫 New service ticket: ${td.subject || "Service request"}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#6366f1;margin-top:0">New Service Ticket</h2>
            <table style="border-collapse:collapse;width:100%;font-size:14px">
              <tr><td style="padding:8px 0;color:#6b7280;width:120px">Subject</td><td style="font-weight:600">${td.subject || "—"}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Customer</td><td>${ld?.name || "Visitor"}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Phone</td><td>${ld?.phone || "—"}</td></tr>
            </table>
            <a href="${process.env.AUTH_URL}/dashboard/tickets"
               style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:20px;font-weight:600">
              View Ticket →
            </a>
          </div>`,
        }).catch(() => {});
      }).catch(() => {});
    } catch (e) { console.error("Ticket:", e); }
  }

  if (result.action === "ASSIGN_AGENT" && conversationId) {
    await Conversation.findByIdAndUpdate(conversationId, {
      "metadata.needsAgent": true,
      $addToSet: { tags: "AGENT_REQUEST" },
    }).catch(() => {});
    sideEffect = { type: "agent_requested" };
    sendWhatsAppLeadAlert(companyId, { kind: "agent_request", name: ld?.name || result.sessionData.collected.name, phone: ld?.phone || result.sessionData.collected.phone, interest: "wants to talk to a person" }).catch(() => {});
    emitNotification(companyId, {
      type: "agent_request",
      conversationId,
      message: `${ld?.name || "Visitor"} is requesting a live agent`,
      name: ld?.name || "Visitor",
    });
  }

  return NextResponse.json({
    success: true,
    data: { messages: result.messages, messageIds: botMessageIds, quickReplies: result.quickReplies, action: result.action, sideEffect, sessionData: result.sessionData },
  }, { headers: CORS });
}
