import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import mongoose from "mongoose";

export async function GET() {
  const checks: Record<string, string> = {};

  // Env vars (masked)
  checks.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ? "SET" : "MISSING";
  checks.AUTH_SECRET = process.env.AUTH_SECRET ? "SET" : "MISSING";
  checks.NEXTAUTH_URL = process.env.NEXTAUTH_URL || "MISSING";
  checks.AUTH_URL = process.env.AUTH_URL || "MISSING";
  checks.MONGODB_URI = process.env.MONGODB_URI ? "SET" : "MISSING";

  // DB connection
  try {
    await connectDB();
    const state = mongoose.connection.readyState;
    checks.db = state === 1 ? "CONNECTED" : `STATE_${state}`;

    // Count users
    const User = mongoose.models.User || (await import("@/models/User")).default;
    const userCount = await User.countDocuments();
    checks.userCount = String(userCount);
  } catch (e) {
    checks.db = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  const allOk = checks.db === "CONNECTED" && Number(checks.userCount) > 0 &&
    (checks.AUTH_SECRET === "SET" || checks.NEXTAUTH_SECRET === "SET");

  return NextResponse.json({ ok: allOk, checks }, { status: allOk ? 200 : 500 });
}
