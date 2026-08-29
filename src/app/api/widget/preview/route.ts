import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError } from "@/lib/api-helpers";
import { processFlow, matchTraining, SessionData } from "@/lib/chatbot-flow";

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

  // Same precedence as the real widget (/api/widget/chat): a company's own Training
  // rules and FAQs from Chatbot Settings take priority over the hardcoded flow. Without
  // this, the preview never reflects anything an admin configures — it only ever shows
  // the generic scripted flow, which is confusing to test against.
  await connectDB();
  const trained = session.flow === "INITIAL" && message !== "__INIT__"
    ? await matchTraining(message, ctx.companyId)
    : null;
  const result = trained ?? processFlow(message, session);

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
