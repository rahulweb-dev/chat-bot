import { GoogleGenerativeAI } from "@google/generative-ai";

// One place to pick the Gemini model. Google retires model versions regularly
// (gemini-1.5-flash is already shut down), so it's overridable via env without
// a code change: set GEMINI_MODEL when the default below is retired.
export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export function getChatModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
  return genAI.getGenerativeModel({ model: AI_MODEL });
}
