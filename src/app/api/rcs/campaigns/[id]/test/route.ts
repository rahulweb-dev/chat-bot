import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { sendRcsMessage } from "@/lib/twilioRcs";
import { rateLimit, rateLimitError } from "@/lib/rate-limit";
import RCSCampaign from "@/models/RCSCampaign";
import RCSIntegration from "@/models/RCSIntegration";
import AuditLog from "@/models/AuditLog";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  if (!(await rateLimit(`rcs-test-send:${ctx.companyId}`, 20, 60 * 60 * 1000))) {
    return rateLimitError();
  }

  await connectDB();
  const body = await request.json();
  const phone = String(body.phone || "").replace(/[^\d]/g, "");
  if (!phone || phone.length < 8) return apiError("A valid test phone number is required");

  const campaign = await RCSCampaign.findOne({ _id: id, companyId: ctx.companyId });
  if (!campaign) return apiError("Not found", 404);
  if (!campaign.body) return apiError("Add message content before sending a test", 400);

  const integration = await RCSIntegration.findOne({ companyId: ctx.companyId, enabled: true });
  if (!integration) return apiError("RCS is not connected — go to Settings and connect first", 400);

  const accountSid = decrypt(integration.encryptedAccountSid);
  const authToken = decrypt(integration.encryptedAuthToken);
  const result = await sendRcsMessage(accountSid, authToken, integration.messagingServiceSid, phone, campaign.body);
  if (!result.ok) return apiError(result.error || "Test send failed");

  await AuditLog.create({
    companyId: ctx.companyId, userId: ctx.userId, action: "TEST_SEND_RCS_CAMPAIGN",
    resource: "rcs_campaign", resourceId: id, details: { phone }, status: "SUCCESS",
  });

  return apiSuccess({ sid: result.sid }, "Test message sent");
}
