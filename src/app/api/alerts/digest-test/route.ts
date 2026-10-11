import { NextRequest } from "next/server";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, rateLimitError } from "@/lib/rate-limit";
import { sendDigestForCompany } from "@/lib/daily-digest";

// "Send me today's summary now" on Settings → Alerts. Sends even on a quiet
// day so the owner can see what it looks like.
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) return apiError("Forbidden", 403);
  if (!(await rateLimit(`digest-test:${ctx.companyId}`, 3, 10 * 60 * 1000))) return rateLimitError();

  const r = await sendDigestForCompany(ctx.companyId, { force: true });
  return apiSuccess({ emailed: r.emailed ?? 0, whatsapped: r.whatsapped ?? 0, stats: r.stats });
}
