import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Booking from "@/models/Booking";

// Bookings made through the chatbot. ?view=upcoming (default) | past | all
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const view = new URL(request.url).searchParams.get("view") || "upcoming";
  const now = new Date();
  // Today's earlier bookings stay under "upcoming" so the team can mark them done.
  const startOfToday = new Date(now.getTime() - 12 * 3_600_000);

  const filter: Record<string, unknown> = { companyId: ctx.companyId };
  if (view === "upcoming") filter.startAt = { $gte: startOfToday };
  if (view === "past") filter.startAt = { $lt: startOfToday };

  const bookings = await Booking.find(filter)
    .sort({ startAt: view === "past" ? -1 : 1 })
    .limit(200)
    .lean();
  return apiSuccess(bookings);
}
