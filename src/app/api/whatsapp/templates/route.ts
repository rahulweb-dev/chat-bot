import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { listTemplates, createTemplate, deleteTemplate } from "@/lib/whatsapp";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";
import AuditLog from "@/models/AuditLog";

async function getIntegration(companyId: string) {
  await connectDB();
  return WhatsAppIntegration.findOne({ companyId });
}

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  const integration = await getIntegration(String(ctx.companyId));
  if (!integration) return apiError("WhatsApp is not connected", 404);

  const accessToken = decrypt(integration.encryptedAccessToken);
  const { searchParams } = new URL(request.url);
  // Default to approved-only (for campaign wizard); templates tab passes ?approvedOnly=false
  const approvedOnly = searchParams.get("approvedOnly") !== "false";
  const result = await listTemplates(integration.businessAccountId, accessToken, approvedOnly);
  if (!result.ok) return apiError(result.error || "Failed to load templates");

  return apiSuccess(result.templates);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  const integration = await getIntegration(String(ctx.companyId));
  if (!integration) return apiError("WhatsApp is not connected", 404);

  const body = await request.json();
  const { name, category, language, components } = body;
  if (!name || !category || !language || !components?.length) {
    return apiError("name, category, language and components are required");
  }

  const accessToken = decrypt(integration.encryptedAccessToken);
  const result = await createTemplate(integration.businessAccountId, accessToken, { name, category, language, components });
  if (!result.ok) return apiError(result.error || "Failed to create template");

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "CREATE_WHATSAPP_TEMPLATE",
    resource: "whatsapp_template",
    details: { name, category, language },
    status: "SUCCESS",
  });

  return apiSuccess({ id: result.id, name, status: result.status || "PENDING" }, "Template submitted for approval", 201);
}

export async function DELETE(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  const { name } = await request.json();
  if (!name) return apiError("Template name is required");

  const integration = await getIntegration(String(ctx.companyId));
  if (!integration) return apiError("WhatsApp is not connected", 404);

  const accessToken = decrypt(integration.encryptedAccessToken);
  const result = await deleteTemplate(integration.businessAccountId, accessToken, name);
  if (!result.ok) return apiError(result.error || "Failed to delete template");

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "DELETE_WHATSAPP_TEMPLATE",
    resource: "whatsapp_template",
    details: { name },
    status: "SUCCESS",
  });

  return apiSuccess(null, "Template deleted");
}
