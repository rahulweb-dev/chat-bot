import { NextRequest } from "next/server";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, rateLimitError } from "@/lib/rate-limit";
import { sendWhatsAppLeadAlert } from "@/lib/lead-alerts";

// "Send test alert" button on Settings → Alerts. Uses the saved settings, so
// save first. Sends even while alerts are switched off, so they can be tried.
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) return apiError("Forbidden", 403);
  if (!(await rateLimit(`wa-test-alert:${ctx.companyId}`, 5, 10 * 60 * 1000))) return rateLimitError();

  const result = await sendWhatsAppLeadAlert(ctx.companyId, {
    kind: "test", name: "Test Visitor", phone: "98765 43210", interest: "site visit", source: "Google Ads",
  });
  return apiSuccess(result);
}
