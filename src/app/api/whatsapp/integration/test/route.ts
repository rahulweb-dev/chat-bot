import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { testConnection } from "@/lib/whatsapp";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";
import AuditLog from "@/models/AuditLog";

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const integration = await WhatsAppIntegration.findOne({ companyId: ctx.companyId });
  if (!integration) return apiError("WhatsApp is not connected", 404);

  const accessToken = decrypt(integration.encryptedAccessToken);
  const result = await testConnection(integration.phoneNumberId, accessToken);

  integration.lastTestedAt = new Date();
  integration.lastTestStatus = result.ok ? "SUCCESS" : "FAILURE";
  integration.lastTestError = result.ok ? undefined : result.error;
  if (result.ok && result.displayPhoneNumber) integration.displayPhoneNumber = result.displayPhoneNumber;
  await integration.save();

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "TEST_WHATSAPP_CONNECTION",
    resource: "whatsapp_integration",
    resourceId: String(integration._id),
    status: result.ok ? "SUCCESS" : "FAILURE",
    errorMessage: result.error,
  });

  if (!result.ok) return apiError(result.error || "Connection test failed");
  return apiSuccess({ displayPhoneNumber: result.displayPhoneNumber, verifiedName: result.verifiedName });
}
