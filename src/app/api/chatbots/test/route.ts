import { NextRequest } from "next/server";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { processFlow, SessionData } from "@/lib/chatbot-flow";

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { message, sessionData } = await request.json();
  if (!message) return apiError("message required", 400);

  const session: SessionData = sessionData?.flow ? sessionData : { flow: "INITIAL", step: "", collected: {} };
  const result = processFlow(message, session);

  return apiSuccess({
    messages: result.messages,
    quickReplies: result.quickReplies,
    action: result.action,
    sessionData: result.sessionData,
  });
}
