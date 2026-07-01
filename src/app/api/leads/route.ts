import { NextRequest, NextResponse } from "next/server";
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
  const format = searchParams.get("format");
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

  // CSV export
  if (format === "csv") {
    const leads = await Lead.find(query)
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const header = ["Name","Email","Phone","Company","Stage","Score","Source","Assigned To","Created At"].join(",");
    const rows = leads.map((l) => [
      `"${(l.name || "").replace(/"/g, '""')}"`,
      `"${(l.email || "").replace(/"/g, '""')}"`,
      `"${(l.phone || "").replace(/"/g, '""')}"`,
      `"${(l.company || "").replace(/"/g, '""')}"`,
      l.stage || "",
      l.score ?? "",
      l.source || "",
      `"${((l.assignedTo as { name?: string } | null)?.name || "").replace(/"/g, '""')}"`,
      new Date(l.createdAt as Date).toISOString().slice(0, 10),
    ].join(",")).join("\n");

    const csv = `${header}\n${rows}`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
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
    companyId: ctx.companyId,
    name: body.name,
    email: body.email,
    phone: body.phone,
    company: body.company,
    title: body.title,
    website: body.website,
    source: body.source || "MANUAL",
    stage: body.stage || "NEW",
    score: typeof body.score === "number" ? Math.min(100, Math.max(0, body.score)) : 50,
    value: body.value,
    currency: body.currency,
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 20) : [],
    assignedTo: body.assignedTo,
    notes: [],
    customFields: body.customFields,
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
