import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, paginatedResponse, paginate } from "@/lib/api-helpers";
import RCSCampaign from "@/models/RCSCampaign";
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
    RCSCampaign.find({ companyId: ctx.companyId }).skip(skip).limit(limit).sort({ createdAt: -1 }),
    RCSCampaign.countDocuments({ companyId: ctx.companyId }),
  ]);

  return paginatedResponse(campaigns, total, page, limit);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();
  const { name, body: messageBody, audienceTags, audienceContactIds } = body;
  if (!name) return apiError("Campaign name is required");

  const campaign = await RCSCampaign.create({
    companyId: ctx.companyId,
    name,
    body: messageBody || "",
    audienceTags: audienceTags || [],
    audienceContactIds: audienceContactIds || [],
    status: "DRAFT",
    createdBy: ctx.userId,
  });

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "CREATE_RCS_CAMPAIGN",
    resource: "rcs_campaign",
    resourceId: String(campaign._id),
    details: { name },
    status: "SUCCESS",
  });

  return apiSuccess(campaign, "Campaign draft created", 201);
}
