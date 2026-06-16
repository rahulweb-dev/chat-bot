import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { encrypt, decrypt, maskSecret } from "@/lib/crypto";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";
import AuditLog from "@/models/AuditLog";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const integration = await WhatsAppIntegration.findOne({ companyId: ctx.companyId });
  if (!integration) return apiSuccess(null);

  return apiSuccess({
    _id: integration._id,
    businessAccountId: integration.businessAccountId,
    phoneNumberId: integration.phoneNumberId,
    displayPhoneNumber: integration.displayPhoneNumber,
    enabled: integration.enabled,
    lastTestedAt: integration.lastTestedAt,
    lastTestStatus: integration.lastTestStatus,
    lastTestError: integration.lastTestError,
    maskedAccessToken: maskSecret(decrypt(integration.encryptedAccessToken)),
    webhookCallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp/${ctx.companyId}`,
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  const body = await request.json();
  const { businessAccountId, phoneNumberId, accessToken, webhookVerifyToken } = body;
  if (!businessAccountId || !phoneNumberId || !accessToken || !webhookVerifyToken) {
    return apiError("All fields are required");
  }

  await connectDB();

  const conflict = await WhatsAppIntegration.findOne({ phoneNumberId, companyId: { $ne: ctx.companyId } });
  if (conflict) return apiError("This Phone Number ID is already connected to another account");

  const integration = await WhatsAppIntegration.findOneAndUpdate(
    { companyId: ctx.companyId },
    {
      companyId: ctx.companyId,
      businessAccountId,
      phoneNumberId,
      encryptedAccessToken: encrypt(accessToken),
      encryptedWebhookVerifyToken: encrypt(webhookVerifyToken),
      enabled: true,
      lastTestStatus: undefined,
      lastTestedAt: undefined,
      lastTestError: undefined,
    },
    { upsert: true, new: true }
  );

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "CONNECT_WHATSAPP",
    resource: "whatsapp_integration",
    resourceId: String(integration._id),
    details: { phoneNumberId },
    status: "SUCCESS",
  });

  return apiSuccess({ connected: true, webhookCallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp/${ctx.companyId}` }, "WhatsApp connected");
}

export async function DELETE(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const integration = await WhatsAppIntegration.findOneAndDelete({ companyId: ctx.companyId });
  if (!integration) return apiError("Not connected", 404);

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "DISCONNECT_WHATSAPP",
    resource: "whatsapp_integration",
    resourceId: String(integration._id),
    status: "SUCCESS",
  });

  return apiSuccess(null, "WhatsApp disconnected");
}
