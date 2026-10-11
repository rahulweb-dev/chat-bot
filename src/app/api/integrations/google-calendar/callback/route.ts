import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, readState } from "@/lib/google-calendar";
import CalendarIntegration from "@/models/CalendarIntegration";

// Google sends the admin back here after consent. Saves the refresh token
// (encrypted) and returns to the booking settings with a status flag.
export async function GET(request: NextRequest) {
  const back = (status: string) =>
    NextResponse.redirect(new URL(`/dashboard/chatbot?tab=bookings&calendar=${status}`, request.nextUrl.origin));

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back("cancelled");
  const state = readState(params.get("state") || "");
  const code = params.get("code");
  if (!state || !code) return back("error");

  try {
    const { refreshToken, email } = await exchangeCode(code, request.nextUrl.origin);
    if (!refreshToken) return back("error");
    await connectDB();
    await CalendarIntegration.findOneAndUpdate(
      { companyId: state.companyId },
      {
        $set: { provider: "GOOGLE", email, calendarId: "primary", encryptedRefreshToken: encrypt(refreshToken), enabled: true, connectedBy: state.userId },
        $unset: { lastError: 1 },
      },
      { upsert: true }
    );
    return back("connected");
  } catch (e) {
    console.error("[google-calendar] callback:", e instanceof Error ? e.message : e);
    return back("error");
  }
}
