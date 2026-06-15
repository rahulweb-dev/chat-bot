import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { processFlow, SessionData, MAIN_MENU } from "@/lib/chatbot-flow";
import Chatbot from "@/models/Chatbot";

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { message, sessionData, chatbotId } = await request.json();
  if (!message) return apiError("message required", 400);

  // In test mode, always skip the IDENTIFY flow — admin is not a first-time visitor
  const session: SessionData = sessionData?.flow
    ? sessionData
    : { flow: "INITIAL", step: "", collected: { name: "Test" } };

  // On __INIT__, use the chatbot's own welcome message (not the flow's generic greeting)
  if (message === "__INIT__") {
    let welcomeMsg = "👋 Welcome to Ashok Leyland!\n\nHow can I help you today? Please select an option:";
    if (chatbotId) {
      await connectDB();
      const bot = await Chatbot.findOne({ _id: chatbotId, companyId: ctx.companyId })
        .select("welcomeMessage")
        .lean() as { welcomeMessage?: string } | null;
      if (bot?.welcomeMessage) welcomeMsg = bot.welcomeMessage;
    }
    return apiSuccess({
      messages: [welcomeMsg],
      quickReplies: MAIN_MENU,
      action: "NONE",
      sessionData: { flow: "INITIAL", step: "", collected: { name: "Test" } },
    });
  }

  const result = processFlow(message, session);

  return apiSuccess({
    messages: result.messages,
    quickReplies: result.quickReplies,
    action: result.action,
    sessionData: result.sessionData,
  });
}
