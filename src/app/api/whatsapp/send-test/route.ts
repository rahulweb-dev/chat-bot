import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { sendTemplate } from "@/lib/whatsapp";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();

  const { to, templateName, templateLanguage = "en" } = await request.json();
  if (!to) return apiError("Phone number is required");
  if (!templateName) return apiError("Template name is required");

  const integration = await WhatsAppIntegration.findOne({ companyId: ctx.companyId, enabled: true });
  if (!integration) return apiError("WhatsApp is not connected — go to Settings and connect first", 400);

  const accessToken = decrypt(integration.encryptedAccessToken);
  const phone = to.replace(/[^\d]/g, "");

  const result = await sendTemplate(integration.phoneNumberId, accessToken, phone, templateName, templateLanguage, []);
  if (!result.ok) return apiError(result.error || "Failed to send");

  return apiSuccess({ messageId: result.whatsappMessageId }, "Message sent");
}
