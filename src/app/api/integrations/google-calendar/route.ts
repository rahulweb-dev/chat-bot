import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { googleCalendarConfigured } from "@/lib/google-calendar";
import CalendarIntegration from "@/models/CalendarIntegration";

// Connection status for the booking settings card.
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  await connectDB();
  const integ = await CalendarIntegration.findOne({ companyId: ctx.companyId })
    .select("email enabled lastError updatedAt").lean<{ email?: string; enabled: boolean; lastError?: string; updatedAt: Date }>();
  return apiSuccess({
    available: googleCalendarConfigured(),
    connected: !!integ?.enabled,
    email: integ?.email,
    error: integ?.lastError,
  });
}

// Disconnect. (Access can also be removed from the Google account itself.)
export async function DELETE(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);
  await connectDB();
  await CalendarIntegration.deleteOne({ companyId: ctx.companyId });
  return apiSuccess(null, "Google Calendar disconnected");
}
