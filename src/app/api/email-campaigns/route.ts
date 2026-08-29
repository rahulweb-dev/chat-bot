import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, paginatedResponse, paginate } from "@/lib/api-helpers";
import EmailCampaign from "@/models/EmailCampaign";
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
    EmailCampaign.find({ companyId: ctx.companyId }).skip(skip).limit(limit).sort({ createdAt: -1 }),
    EmailCampaign.countDocuments({ companyId: ctx.companyId }),
  ]);

  return paginatedResponse(campaigns, total, page, limit);
}

// Creates a DRAFT campaign — subject/html/audience are filled in via later PATCH
// calls as the wizard progresses, so only a name is required here.
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();
  const { name, subject, html, audienceTags, audienceContactIds } = body;
  if (!name) return apiError("Campaign name is required");

  const campaign = await EmailCampaign.create({
    companyId: ctx.companyId,
    name,
    subject: subject || "",
    html: html || "",
    audienceTags: audienceTags || [],
    audienceContactIds: audienceContactIds || [],
    status: "DRAFT",
    createdBy: ctx.userId,
  });

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "CREATE_EMAIL_CAMPAIGN",
    resource: "email_campaign",
    resourceId: String(campaign._id),
    details: { name },
    status: "SUCCESS",
  });

  return apiSuccess(campaign, "Campaign draft created", 201);
}
