import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError } from "@/lib/api-helpers";
import { getBotReply, SessionData } from "@/lib/chatbot-flow";
import Settings from "@/models/Settings";

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  const body = await request.json();
  const { message, sessionData } = body;

  if (!message || typeof message !== "string" || message.length > 2000) {
    return NextResponse.json({ success: false, error: "Invalid message" }, { status: 400 });
  }

  // Pre-populate name so the admin preview skips the IDENTIFY flow and goes straight to the main menu
  const session: SessionData = sessionData?.flow
    ? (sessionData as SessionData)
    : { flow: "INITIAL", step: "", collected: { name: "Preview" } };

  await connectDB();

  // Same precedence as the real widget (/api/widget/chat): a company's own Training
  // rules and FAQs take priority, then their custom menu flow if they've built one,
  // then the built-in demo flow — this is the exact same call the live widget makes,
  // so the preview always reflects whatever an admin configures.
  const settings = await Settings.findOne({ companyId: ctx.companyId }).select("widget.welcomeMessage").lean() as { widget?: { welcomeMessage?: string } } | null;
  const result = await getBotReply(message, session, ctx.companyId, settings?.widget?.welcomeMessage);

  return NextResponse.json({
    success: true,
    data: {
      messages:    result.messages,
      quickReplies: result.quickReplies,
      action:      result.action,
      sessionData: result.sessionData,
    },
  });
}
