import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, rateLimitError } from "@/lib/rate-limit";
import { sendCampaignEmail } from "@/lib/resend";
import { renderCampaignEmail } from "@/lib/emailCampaignRender";
import EmailCampaign from "@/models/EmailCampaign";
import AuditLog from "@/models/AuditLog";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  // Test sends aren't charged against the monthly plan limit, so they need their own cap.
  if (!(await rateLimit(`email-test-send:${ctx.companyId}`, 20, 60 * 60 * 1000))) {
    return rateLimitError();
  }

  await connectDB();
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return apiError("A valid test email address is required");

  const campaign = await EmailCampaign.findOne({ _id: id, companyId: ctx.companyId });
  if (!campaign) return apiError("Not found", 404);
  if (!campaign.subject || !campaign.html) return apiError("Add a subject and content before sending a test", 400);

  const html = renderCampaignEmail(campaign.html, { name: "there", email }, `${process.env.AUTH_URL || ""}/api/email/unsubscribe?token=test`);
  const result = await sendCampaignEmail({ to: email, subject: `[TEST] ${campaign.subject}`, html, fromName: campaign.fromName });
  if (!result.ok) return apiError(result.error || "Test send failed");

  await AuditLog.create({
    companyId: ctx.companyId, userId: ctx.userId, action: "TEST_SEND_EMAIL_CAMPAIGN",
    resource: "email_campaign", resourceId: id, details: { email }, status: "SUCCESS",
  });

  return apiSuccess({ resendMessageId: result.id }, "Test email sent");
}
