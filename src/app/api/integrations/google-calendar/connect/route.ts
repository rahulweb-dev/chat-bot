import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, apiError } from "@/lib/api-helpers";
import { authUrl, googleCalendarConfigured, signState } from "@/lib/google-calendar";

// Starts "Connect Google Calendar": sends the admin to Google's consent screen.
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Only admins and managers can connect a calendar", 403);
  if (!googleCalendarConfigured()) return apiError("Google Calendar isn't set up on this server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).", 503);

  return NextResponse.redirect(authUrl(request.nextUrl.origin, signState(ctx.companyId, ctx.userId)));
}
