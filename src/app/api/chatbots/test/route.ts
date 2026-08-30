import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { getBotReply, SessionData } from "@/lib/chatbot-flow";
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
  // take priority, then their custom menu flow if they've built one, then the
  // built-in demo flow — same single source of truth as /api/widget/chat and
  // /api/widget/preview, so this test panel reflects what's configured elsewhere.
  await connectDB();
  const settings = await Settings.findOne({ companyId: ctx.companyId }).select("widget.welcomeMessage general.timezone").lean() as { widget?: { welcomeMessage?: string }; general?: { timezone?: string } } | null;
  const result = await getBotReply(message, session, ctx.companyId, settings?.widget?.welcomeMessage, settings?.general?.timezone);

  return apiSuccess({
    messages: result.messages,
    quickReplies: result.quickReplies,
    action: result.action,
    sessionData: result.sessionData,
  });
}
