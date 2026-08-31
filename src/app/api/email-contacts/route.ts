import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, paginatedResponse, paginate, apiSuccess } from "@/lib/api-helpers";
import EmailContact from "@/models/EmailContact";
import EmailCampaign from "@/models/EmailCampaign";
import EmailCampaignRecipient from "@/models/EmailCampaignRecipient";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search");
  const tag = searchParams.get("tag");
  const optIn = searchParams.get("optIn");
  const campaignId = searchParams.get("campaignId");

  const query: Record<string, unknown> = { companyId: ctx.companyId };
  if (tag) query.tags = tag;
  if (optIn !== null && optIn !== "") query.optIn = optIn === "true";
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  if (campaignId) {
    const campaign = await EmailCampaign.findOne({ _id: campaignId, companyId: ctx.companyId }).select("audienceContactIds");
    query._id = { $in: campaign?.audienceContactIds || [] };
  }
  if (ctx.userRole === "AGENT") query.assignedTo = ctx.userId;

  const { skip } = paginate(page, limit);
  const [contacts, total] = await Promise.all([
    EmailContact.find(query).populate("assignedTo", "name").skip(skip).limit(limit).sort({ createdAt: -1 }),
    EmailContact.countDocuments(query),
  ]);

  // "Engaged" = has opened or clicked at least one campaign email — the
  // engagement signal standing in for true reply tracking, which this app
  // doesn't have inbound-email infrastructure for yet.
  const contactIds = contacts.map((c) => c._id);
  const engagedIds = new Set(
    (await EmailCampaignRecipient.find({ contactId: { $in: contactIds }, status: { $in: ["OPENED", "CLICKED"] } }).distinct("contactId")).map(String)
  );
  const withEngagement = contacts.map((c) => ({ ...c.toObject(), engaged: engagedIds.has(String(c._id)) }));

  return paginatedResponse(withEngagement, total, page, limit);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const body = await request.json();
  const { name, email, tags, optIn } = body;
  if (!email) return apiError("Email is required");

  const existing = await EmailContact.findOne({ companyId: ctx.companyId, email: email.toLowerCase() });
  if (existing) return apiError("A contact with this email already exists");

  const contact = await EmailContact.create({
    companyId: ctx.companyId,
    name,
    email,
    tags: tags || [],
    optIn: optIn !== false,
    optInAt: optIn !== false ? new Date() : undefined,
  });

  return apiSuccess(contact, "Contact created", 201);
}
