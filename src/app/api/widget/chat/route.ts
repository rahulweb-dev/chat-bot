import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { processFlow, SessionData } from "@/lib/chatbot-flow";
import Company from "@/models/Company";
import ApiKey from "@/models/ApiKey";
import ChatbotConfig from "@/models/ChatbotConfig";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import Lead from "@/models/Lead";
import Ticket from "@/models/Ticket";
import { getIO } from "@/server/socket";
import { triggerChat } from "@/lib/pusher";
import { rateLimit, rateLimitError } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import User from "@/models/User";

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
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

async function matchTraining(message: string, companyId: string): Promise<ReturnType<typeof processFlow> | null> {
  const config = await ChatbotConfig.findOne({ companyId }).lean() as {
    training?: { trigger: string; keywords: string[]; response: string; isActive: boolean }[];
    faqs?: { question: string; answer: string; isActive: boolean }[];
  } | null;
  if (!config) return null;

  const lower = message.toLowerCase();

  const entry = config.training?.find(t => t.isActive && t.keywords.some(k => lower.includes(k.toLowerCase())));
  if (entry) {
    return { messages: [entry.response], quickReplies: ["🔙 Main Menu"], action: "NONE", sessionData: { flow: "INITIAL", step: "", collected: {} } };
  }

  // Fallback: FAQ word match
  const faq = config.faqs?.find(f => {
    if (!f.isActive) return false;
    const words = f.question.toLowerCase().split(/[\s?!.,]+/).filter(w => w.length > 3);
    return words.some(w => lower.includes(w));
  });
  if (faq) {
    return { messages: [faq.answer], quickReplies: ["🔙 Main Menu"], action: "NONE", sessionData: { flow: "INITIAL", step: "", collected: {} } };
  }

  return null;
}

async function nextTicketNumber(companyId: string): Promise<string> {
  const count = await Ticket.countDocuments({ companyId });
  return `TKT-${String(count + 1).padStart(5, "0")}`;
}

export async function POST(request: NextRequest) {
  // Rate limit: 30 messages per minute per IP, 120 per minute per API key
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const ipOk  = await rateLimit(`widget:ip:${ip}`,  30, 60_000);
  if (!ipOk)  return rateLimitError();

  const body = await request.json();
  const { apiKey, conversationId, message, sessionData } = body;

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
      const session: SessionData = sessionData?.flow ? sessionData : { flow: "INITIAL", step: "", collected: {} };
      return NextResponse.json({ success: true, data: { messages: [], quickReplies: [], action: "NONE", sideEffect: {}, sessionData: session } }, { headers: CORS });
    }
  }

  const session: SessionData = sessionData?.flow ? sessionData : { flow: "INITIAL", step: "", collected: {} };

  // Check custom training rules + FAQs before the hardcoded flow (only when not mid-conversation)
  const trained = session.flow === "INITIAL" && message !== "__INIT__"
    ? await matchTraining(message, companyId)
    : null;
  const result = trained ?? processFlow(message, session);

  if (conversationId) {
    if (message !== "__INIT__") {
      const visitorMsg = await Message.create({ companyId, conversationId, senderType: "VISITOR", type: "TEXT", content: message, isDelivered: true }).catch(() => null);
      // Push visitor message to admin dashboard in real-time
      if (visitorMsg) {
        const io = getIO();
        if (io) {
          io.to(`conversation:${conversationId}`).emit("message:new", visitorMsg);
          io.to(`company:${companyId}`).emit("message:new", { ...visitorMsg.toObject(), conversationId });
          io.to(`company:${companyId}`).emit("conversation:updated", { conversationId, lastMessage: message, lastMessageAt: new Date() });
        }
      }
    }
    for (const msg of result.messages) {
      const saved = await Message.create({ companyId, conversationId, senderType: "BOT", type: "TEXT", content: msg, isDelivered: true }).catch(() => null);
      if (saved) {
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
          activities: [{ type: "CHAT", description: `Widget lead: ${ld.type}`, createdAt: new Date() }],
        });
        sideEffect = { type: "lead_created", leadId: lead._id };
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

  if (result.action === "CREATE_TICKET" && td && conversationId) {
    try {
      const ticket = await Ticket.create({
        companyId, conversationId,
        ticketNumber: await nextTicketNumber(companyId),
        subject: td.subject, description: td.description,
        status: "OPEN", priority: "NORMAL", category: "SERVICE", tags: ["WIDGET"],
        requester: { name: ld?.name || "Visitor", email: ld?.email || "visitor@widget.com", phone: ld?.phone || "" },
        customFields: { vehicleNumber: td.vehicleNumber, serviceType: td.serviceType },
      });
      if (ld?.phone) {
        await Lead.create({ companyId, conversationId, name: ld.name || "Visitor", phone: ld.phone, source: "CHAT_WIDGET", stage: "NEW", score: 50, currency: "INR", tags: ["SERVICE", "AUTO_DEALERSHIP"] }).catch(() => {});
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
    emitNotification(companyId, {
      type: "agent_request",
      conversationId,
      message: `${ld?.name || "Visitor"} is requesting a live agent`,
      name: ld?.name || "Visitor",
    });
  }

  return NextResponse.json({
    success: true,
    data: { messages: result.messages, quickReplies: result.quickReplies, action: result.action, sideEffect, sessionData: result.sessionData },
  }, { headers: CORS });
}
