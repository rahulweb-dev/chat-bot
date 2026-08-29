import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { processFlow, matchTraining, SessionData } from "@/lib/chatbot-flow";
import Settings from "@/models/Settings";

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  const { message, sessionData } = await request.json();
  if (!message) return apiError("message required", 400);

  // In test mode, always skip the IDENTIFY flow — admin is not a first-time visitor
  const session: SessionData = sessionData?.flow
    ? sessionData
    : { flow: "INITIAL", step: "", collected: { name: "Test" } };

  // Same precedence as the real widget: a company's own Training rules and FAQs
  // take priority over the hardcoded flow, and the saved Widget welcome message
  // (Widget Builder → Content) replaces the generic greeting — same single source
  // of truth as /api/widget/chat and /api/widget/preview, so this test panel
  // actually reflects what's configured elsewhere instead of its own copy of it.
  await connectDB();
  const trained = session.flow === "INITIAL" && message !== "__INIT__"
    ? await matchTraining(message, ctx.companyId)
    : null;
  const settings = await Settings.findOne({ companyId: ctx.companyId }).select("widget.welcomeMessage").lean() as { widget?: { welcomeMessage?: string } } | null;
  const result = trained ?? processFlow(message, session, settings?.widget?.welcomeMessage);

  return apiSuccess({
    messages: result.messages,
    quickReplies: result.quickReplies,
    action: result.action,
    sessionData: result.sessionData,
  });
}
