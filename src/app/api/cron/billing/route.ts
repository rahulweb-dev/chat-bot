import { NextRequest, NextResponse } from "next/server";
import { runBillingLifecycle } from "@/lib/billing-lifecycle";
import { runBookingReminders } from "@/lib/booking-reminders";

// Same job the custom server runs hourly (server.ts), exposed for hosts where
// that server doesn't run (e.g. Vercel Cron). Call with
// `Authorization: Bearer $CRON_SECRET`. Safe to call repeatedly — every email
// is claimed atomically so it's sent once.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  // Booking reminders ride along so one scheduled call covers both jobs.
  const [billing, bookingReminders] = await Promise.all([runBillingLifecycle(), runBookingReminders()]);
  return NextResponse.json({ success: true, data: { billing, bookingReminders } });
}
