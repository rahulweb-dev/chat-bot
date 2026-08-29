import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { testTwilioConnection } from "@/lib/twilioRcs";
import RCSIntegration from "@/models/RCSIntegration";
import AuditLog from "@/models/AuditLog";

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const integration = await RCSIntegration.findOne({ companyId: ctx.companyId });
  if (!integration) return apiError("RCS is not connected", 404);

  const accountSid = decrypt(integration.encryptedAccountSid);
  const authToken = decrypt(integration.encryptedAuthToken);
  const result = await testTwilioConnection(accountSid, authToken);

  integration.lastTestedAt = new Date();
  integration.lastTestStatus = result.ok ? "SUCCESS" : "FAILURE";
  integration.lastTestError = result.ok ? undefined : result.error;
  await integration.save();

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "TEST_RCS_CONNECTION",
    resource: "rcs_integration",
    resourceId: String(integration._id),
    status: result.ok ? "SUCCESS" : "FAILURE",
    errorMessage: result.error,
  });

  if (!result.ok) return apiError(result.error || "Connection test failed");
  return apiSuccess({ friendlyName: result.friendlyName });
}
