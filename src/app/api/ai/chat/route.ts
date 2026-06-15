import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, checkUsageLimit, incrementUsage } from "@/lib/api-helpers";
import KnowledgeBase from "@/models/KnowledgeBase";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  const usageCheck = await checkUsageLimit(ctx.companyId, "aiMessages" as keyof import("@/models/Usage").IUsage);
  if (!usageCheck.allowed) {
    return apiError(`AI message limit reached (${usageCheck.limit}). Please upgrade your plan.`, 429);
  }

  const body = await request.json();
  const { message, conversationHistory = [], knowledgeBaseIds = [], mode = "chat" } = body;

  if (!message) return apiError("Message required");

  await connectDB();

  let contextContent = "";
  if (knowledgeBaseIds.length > 0) {
    const kbItems = await KnowledgeBase.find({
      _id: { $in: knowledgeBaseIds },
      companyId: ctx.companyId,
      status: "READY",
    });
    contextContent = kbItems.map((kb) => kb.content).filter(Boolean).join("\n\n---\n\n").slice(0, 8000);
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  let systemPrompt = "";
  if (mode === "summary") {
    systemPrompt = "You are an AI assistant. Summarize the following conversation in 3-4 sentences, highlighting key issues, decisions made, and action items.";
  } else if (mode === "sentiment") {
    systemPrompt = "Analyze the sentiment of the following message. Respond with JSON: {sentiment: 'POSITIVE'|'NEGATIVE'|'NEUTRAL', score: 0-1, explanation: string}";
  } else if (mode === "intent") {
    systemPrompt = "Detect the intent of the following message. Respond with JSON: {intent: string, confidence: 0-1, entities: object}";
  } else if (mode === "suggest_replies") {
    systemPrompt = "Based on the conversation, suggest 3 short, professional reply options for the agent. Return as JSON array of strings.";
  } else {
    systemPrompt = contextContent
      ? `You are a helpful customer support AI assistant. Use the following knowledge base to answer questions:\n\n${contextContent}\n\nIf you don't know the answer from the knowledge base, say so politely and offer to connect them with a human agent.`
      : "You are a helpful customer support AI assistant. Be professional, empathetic, and concise.";
  }

  const history = conversationHistory.map((msg: { role: string; content: string }) => ({
    role: msg.role === "agent" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({
    history,
    systemInstruction: systemPrompt,
  });

  const result = await chat.sendMessage(message);
  const response = result.response.text();

  await incrementUsage(ctx.companyId, "aiMessages");

  return apiSuccess({
    response,
    mode,
    usage: { current: usageCheck.current + 1, limit: usageCheck.limit },
  });
}
