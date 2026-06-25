import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { sendTemplate, buildTemplateComponents } from "@/lib/whatsapp";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";
import AuditLog from "@/models/AuditLog";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();
  const phone = String(body.phone || "").replace(/[^\d]/g, "");
  if (!phone || phone.length < 8) return apiError("A valid test phone number is required");

  const campaign = await WhatsAppCampaign.findOne({ _id: id, companyId: ctx.companyId });
  if (!campaign) return apiError("Not found", 404);
  if (!campaign.templateName) return apiError("Select a template before sending a test", 400);

  const integration = await WhatsAppIntegration.findOne({ companyId: ctx.companyId, enabled: true });
  if (!integration) return apiError("WhatsApp is not connected — go to Settings and connect your WhatsApp Business account first", 400);

  const accessToken = decrypt(integration.encryptedAccessToken);
  const components = buildTemplateComponents({
    offerImageUrl: campaign.offerImageUrl,
    variables: campaign.variables,
    ctaType: campaign.ctaType,
    ctaUrl: campaign.ctaUrl,
  });

  const result = await sendTemplate(integration.phoneNumberId, accessToken, phone, campaign.templateName, campaign.templateLanguage, components);
  if (!result.ok) {
    return apiError(result.error || "Test send failed — check that the phone number is a registered test recipient in your Meta App");
  }

  await AuditLog.create({
    companyId: ctx.companyId, userId: ctx.userId, action: "TEST_SEND_WHATSAPP_CAMPAIGN",
    resource: "whatsapp_campaign", resourceId: id, details: { phone }, status: "SUCCESS",
  });

  return apiSuccess({ whatsappMessageId: result.whatsappMessageId }, "Test message sent");
}
