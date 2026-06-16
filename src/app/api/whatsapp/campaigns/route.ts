import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, paginatedResponse, paginate } from "@/lib/api-helpers";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import AuditLog from "@/models/AuditLog";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const { skip } = paginate(page, limit);
  const [campaigns, total] = await Promise.all([
    WhatsAppCampaign.find({ companyId: ctx.companyId }).skip(skip).limit(limit).sort({ createdAt: -1 }),
    WhatsAppCampaign.countDocuments({ companyId: ctx.companyId }),
  ]);

  return paginatedResponse(campaigns, total, page, limit);
}

// Creates a DRAFT campaign — the wizard fills in template/audience/offer content
// across later steps via PATCH, so only a name is required here.
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();
  const { name, templateName, templateLanguage, audienceTags, audienceContactIds } = body;
  if (!name) return apiError("Campaign name is required");

  const campaign = await WhatsAppCampaign.create({
    companyId: ctx.companyId,
    name,
    templateName,
    templateLanguage: templateLanguage || "en_US",
    audienceTags: audienceTags || [],
    audienceContactIds: audienceContactIds || [],
    status: "DRAFT",
    createdBy: ctx.userId,
  });

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "CREATE_WHATSAPP_CAMPAIGN",
    resource: "whatsapp_campaign",
    resourceId: String(campaign._id),
    details: { name },
    status: "SUCCESS",
  });

  return apiSuccess(campaign, "Campaign draft created", 201);
}
