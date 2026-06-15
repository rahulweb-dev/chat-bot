import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, paginatedResponse, paginate, incrementUsage } from "@/lib/api-helpers";
import Lead from "@/models/Lead";
import Notification from "@/models/Notification";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const stage = searchParams.get("stage");
  const assignedTo = searchParams.get("assignedTo");
  const search = searchParams.get("search");

  const query: Record<string, unknown> = { companyId: ctx.companyId };
  if (stage) query.stage = stage;
  if (assignedTo) query.assignedTo = assignedTo;
  if (ctx.userRole === "AGENT") query.assignedTo = ctx.userId;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { company: { $regex: search, $options: "i" } },
    ];
  }

  const { skip } = paginate(page, limit);
  const [leads, total] = await Promise.all([
    Lead.find(query)
      .populate("assignedTo", "name email avatar")
      .skip(skip).limit(limit).sort({ createdAt: -1 }),
    Lead.countDocuments(query),
  ]);

  return paginatedResponse(leads, total, page, limit);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const body = await request.json();

  const lead = await Lead.create({
    ...body,
    companyId: ctx.companyId,
    stage: body.stage || "NEW",
  });

  if (lead.assignedTo) {
    await Notification.create({
      companyId: ctx.companyId,
      userId: lead.assignedTo,
      type: "LEAD_CREATED",
      title: "New Lead Assigned",
      message: `New lead: ${body.name}`,
      data: { leadId: lead._id },
      link: `/dashboard/leads/${lead._id}`,
    });
  }

  await incrementUsage(ctx.companyId, "leads");

  return apiSuccess(lead, "Lead created", 201);
}
