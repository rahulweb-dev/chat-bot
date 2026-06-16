import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { listTemplates } from "@/lib/whatsapp";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const integration = await WhatsAppIntegration.findOne({ companyId: ctx.companyId });
  if (!integration) return apiError("WhatsApp is not connected", 404);

  const accessToken = decrypt(integration.encryptedAccessToken);
  const result = await listTemplates(integration.businessAccountId, accessToken);
  if (!result.ok) return apiError(result.error || "Failed to load templates");

  return apiSuccess(result.templates);
}
