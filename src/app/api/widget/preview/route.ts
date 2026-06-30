import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError } from "@/lib/api-helpers";
import { processFlow, SessionData } from "@/lib/chatbot-flow";
import { processCustomFlow, type FlowDef } from "@/lib/custom-flow";
import ChatbotConfig from "@/models/ChatbotConfig";

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  const body = await request.json();
  const { message, sessionData } = body;

  if (!message || typeof message !== "string" || message.length > 2000) {
    return NextResponse.json({ success: false, error: "Invalid message" }, { status: 400 });
  }

  await connectDB();

  const session: SessionData = sessionData?.flow
    ? (sessionData as SessionData)
    : { flow: "INITIAL", step: "", collected: { name: "Preview" } };

  const config = await ChatbotConfig.findOne({ companyId: ctx.companyId }).lean() as {
    customFlow?: { enabled: boolean; flow: Record<string, unknown> | null };
  } | null;

  const isCustom = config?.customFlow?.enabled && config.customFlow.flow;
  const result = isCustom
    ? processCustomFlow(message, session, config!.customFlow!.flow as unknown as FlowDef)
    : processFlow(message, session);

  return NextResponse.json({
    success: true,
    data: {
      messages:     result.messages,
      quickReplies: result.quickReplies,
      action:       result.action,
      sessionData:  result.sessionData,
    },
  });
}
