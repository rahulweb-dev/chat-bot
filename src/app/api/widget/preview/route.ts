import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, apiError } from "@/lib/api-helpers";
import { processFlow, SessionData } from "@/lib/chatbot-flow";

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

  const result = processFlow(message, session);

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
