import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { encrypt, decrypt, maskSecret } from "@/lib/crypto";
import RCSIntegration from "@/models/RCSIntegration";
import AuditLog from "@/models/AuditLog";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const integration = await RCSIntegration.findOne({ companyId: ctx.companyId });
  if (!integration) return apiSuccess(null);

  return apiSuccess({
    _id: integration._id,
    maskedAccountSid: maskSecret(decrypt(integration.encryptedAccountSid)),
    messagingServiceSid: integration.messagingServiceSid,
    enabled: integration.enabled,
    lastTestedAt: integration.lastTestedAt,
    lastTestStatus: integration.lastTestStatus,
    lastTestError: integration.lastTestError,
    webhookCallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/rcs/${ctx.companyId}`,
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  const body = await request.json();
  const { accountSid, authToken, messagingServiceSid } = body;
  if (!accountSid || !authToken || !messagingServiceSid) {
    return apiError("Account SID, Auth Token, and Messaging Service SID are all required");
  }

  await connectDB();

  const integration = await RCSIntegration.findOneAndUpdate(
    { companyId: ctx.companyId },
    {
      companyId: ctx.companyId,
      encryptedAccountSid: encrypt(accountSid),
      encryptedAuthToken: encrypt(authToken),
      messagingServiceSid,
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
    action: "CONNECT_RCS",
    resource: "rcs_integration",
    resourceId: String(integration._id),
    status: "SUCCESS",
  });

  return apiSuccess({ connected: true, webhookCallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/rcs/${ctx.companyId}` }, "RCS (Twilio) connected");
}

export async function DELETE(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const integration = await RCSIntegration.findOneAndDelete({ companyId: ctx.companyId });
  if (!integration) return apiError("Not connected", 404);

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "DISCONNECT_RCS",
    resource: "rcs_integration",
    resourceId: String(integration._id),
    status: "SUCCESS",
  });

  return apiSuccess(null, "RCS disconnected");
}
