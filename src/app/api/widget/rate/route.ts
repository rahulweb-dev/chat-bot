import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Conversation from "@/models/Conversation";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { conversationId, rating, feedback } = body;

  if (!conversationId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ success: false, error: "conversationId and rating (1-5) required" }, { status: 400, headers: CORS });
  }

  await connectDB();

  await Conversation.findByIdAndUpdate(conversationId, {
    "csat.rating":      rating,
    "csat.feedback":    feedback || "",
    "csat.submittedAt": new Date(),
  });

  return NextResponse.json({ success: true }, { headers: CORS });
}
