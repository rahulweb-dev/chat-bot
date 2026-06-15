import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Company from "@/models/Company";
import ApiKey from "@/models/ApiKey";
import Settings from "@/models/Settings";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import { v4 as uuidv4 } from "uuid";

// Resolves a widget API key to a company — supports both Company.apiKey and ApiKey model
async function resolveCompany(apiKey: string) {
  // 1. Try direct company apiKey (set at registration)
  let company = await Company.findOne({ apiKey, isActive: true });
  if (company) return company;

  // 2. Try ApiKey model (keys created from Dashboard → API Keys page)
  const keyDoc = await ApiKey.findOne({ key: apiKey, isActive: true });
  if (keyDoc) {
    company = await Company.findOne({ _id: keyDoc.companyId, isActive: true });
    if (company) {
      // Update last used
      ApiKey.findByIdAndUpdate(keyDoc._id, { lastUsedAt: new Date(), $inc: { requestCount: 1 } }).catch(() => {});
      return company;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get("key");

  if (!apiKey) {
    return NextResponse.json({ success: false, error: "API key required" }, { status: 400 });
  }

  await connectDB();
  const company = await resolveCompany(apiKey);
  if (!company) {
    return NextResponse.json({ success: false, error: "Invalid API key" }, { status: 401 });
  }

  const settings = await Settings.findOne({ companyId: company._id });

  return NextResponse.json({
    success: true,
    data: {
      companyId: company._id,
      name: company.name,
      logo: company.logo,
      settings: {
        primaryColor: settings?.widget?.primaryColor || company.settings.brandColor,
        theme: settings?.widget?.theme || "LIGHT",
        position: settings?.widget?.position || "BOTTOM_RIGHT",
        welcomeMessage: settings?.widget?.welcomeMessage || company.settings.welcomeMessage,
        offlineMessage: settings?.widget?.offlineMessage || company.settings.offlineMessage,
        showAgentAvatar: settings?.widget?.showAgentAvatar ?? true,
        showAgentName: settings?.widget?.showAgentName ?? true,
        logo: settings?.widget?.logo || company.logo,
        customCss: settings?.widget?.customCss,
      },
    },
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { apiKey, action, data } = body;

  if (!apiKey) return NextResponse.json({ success: false, error: "API key required" }, { status: 400 });

  await connectDB();
  const company = await resolveCompany(apiKey);
  if (!company) return NextResponse.json({ success: false, error: "Invalid API key" }, { status: 401 });

  const companyId = company._id.toString();
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (action === "start_conversation") {
    const visitorId = data.visitorId || uuidv4();
    const conversation = await Conversation.create({
      companyId,
      status: "OPEN",
      visitor: {
        visitorId,
        name: data.visitorName || data.name,
        email: data.email,
        phone: data.visitorPhone || data.phone,
        currentPage: data.currentPage,
        referrer: data.referrer,
        userAgent: data.userAgent,
        isLoggedIn: !!data.userId,
      },
    });

    // Notify admin live chat in real-time (works when Socket.IO is running with custom server)
    try {
      const { getIO } = require("@/server/socket") as { getIO: () => import("socket.io").Server | undefined };
      getIO()?.to(`company:${companyId}`).emit("conversation:new", {
        conversationId: conversation._id.toString(),
        visitor: { name: data.visitorName || data.name, phone: data.visitorPhone || data.phone, visitorId },
      });
    } catch { /* Socket not available in serverless */ }

    return NextResponse.json(
      { success: true, data: { conversationId: conversation._id, visitorId } },
      { headers: corsHeaders }
    );
  }

  if (action === "send_message") {
    const { conversationId, content, visitorId, type = "TEXT", attachments } = data;
    if (!conversationId || !content) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    const conversation = await Conversation.findOne({ _id: conversationId, companyId });
    if (!conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404, headers: corsHeaders });
    }

    const message = await Message.create({
      companyId,
      conversationId,
      senderType: "VISITOR",
      type,
      content,
      attachments,
      isDelivered: true,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageAt: new Date(),
      $inc: { messageCount: 1 },
    });

    return NextResponse.json(
      { success: true, data: message },
      { headers: corsHeaders }
    );
  }

  if (action === "get_messages") {
    const { conversationId, after } = data;
    const query: Record<string, unknown> = { conversationId, companyId };
    if (after) query.createdAt = { $gt: new Date(after) };

    const messages = await Message.find(query)
      .populate("senderId", "name avatar")
      .sort({ createdAt: 1 })
      .limit(50);

    return NextResponse.json({ success: true, data: messages }, { headers: corsHeaders });
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400, headers: corsHeaders });
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
