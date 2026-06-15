import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { processFlow, SessionData } from "@/lib/chatbot-flow";
import Company from "@/models/Company";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import Lead from "@/models/Lead";
import Ticket from "@/models/Ticket";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

async function nextTicketNumber(companyId: string): Promise<string> {
  const count = await Ticket.countDocuments({ companyId });
  return `TKT-${String(count + 1).padStart(5, "0")}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { apiKey, conversationId, message, sessionData } = body;

  if (!apiKey || !message) {
    return NextResponse.json({ success: false, error: "apiKey and message required" }, { status: 400, headers: CORS });
  }

  if (typeof message !== "string" || message.length > 2000) {
    return NextResponse.json({ success: false, error: "Message too long (max 2000 chars)" }, { status: 400, headers: CORS });
  }

  await connectDB();
  const company = await Company.findOne({ apiKey, isActive: true });
  if (!company) return NextResponse.json({ success: false, error: "Invalid API key" }, { status: 401, headers: CORS });

  const companyId = company._id.toString();
  const session: SessionData = sessionData?.flow ? sessionData : { flow: "INITIAL", step: "", collected: {} };
  const result = processFlow(message, session);

  if (conversationId) {
    if (message !== "__INIT__") {
      await Message.create({ companyId, conversationId, senderType: "VISITOR", type: "TEXT", content: message, isDelivered: true }).catch(() => {});
    }
    for (const msg of result.messages) {
      await Message.create({ companyId, conversationId, senderType: "BOT", type: "TEXT", content: msg, isDelivered: true }).catch(() => {});
    }
    await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date(), $inc: { messageCount: result.messages.length + 1 } }).catch(() => {});
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
    } catch (e) { console.error("Ticket:", e); }
  }

  if (result.action === "ASSIGN_AGENT" && conversationId) {
    await Conversation.findByIdAndUpdate(conversationId, { "metadata.needsAgent": true }).catch(() => {});
    sideEffect = { type: "agent_requested" };
  }

  return NextResponse.json({
    success: true,
    data: { messages: result.messages, quickReplies: result.quickReplies, action: result.action, sideEffect, sessionData: result.sessionData },
  }, { headers: CORS });
}
