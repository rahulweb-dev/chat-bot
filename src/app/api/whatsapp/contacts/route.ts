import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, paginatedResponse, paginate, apiSuccess } from "@/lib/api-helpers";
import WhatsAppContact from "@/models/WhatsAppContact";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import WhatsAppConversation from "@/models/WhatsAppConversation";

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
      { phone: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  // Two independent sources can narrow the contact list down to a specific set of
  // IDs — a campaign's audience, and (for agents) which contacts they're actually
  // assigned to. Intersect rather than overwrite so both apply when both are present.
  let idFilter: string[] | null = null;

  if (campaignId) {
    const campaign = await WhatsAppCampaign.findOne({ _id: campaignId, companyId: ctx.companyId }).select("audienceContactIds");
    idFilter = (campaign?.audienceContactIds || []).map(String);
  }

  if (ctx.userRole === "AGENT") {
    // Contacts have no assignment field of their own — an agent can see a contact
    // if they're assigned to at least one conversation with that contact, reusing
    // the assignment that's already set from the Inbox tab rather than needing a
    // separate "assign this contact" workflow.
    const assignedContactIds = await WhatsAppConversation.find({ companyId: ctx.companyId, assignedAgentId: ctx.userId }).distinct("contactId");
    const assignedIds = assignedContactIds.map(String);
    idFilter = idFilter ? idFilter.filter((id) => assignedIds.includes(id)) : assignedIds;
  }

  if (idFilter) query._id = { $in: idFilter };

  const { skip } = paginate(page, limit);
  const [contacts, total] = await Promise.all([
    WhatsAppContact.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
    WhatsAppContact.countDocuments(query),
  ]);

  return paginatedResponse(contacts, total, page, limit);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const body = await request.json();
  const { name, phone, email, city, tags, optIn } = body;
  if (!phone) return apiError("Phone is required");

  const existing = await WhatsAppContact.findOne({ companyId: ctx.companyId, phone });
  if (existing) return apiError("A contact with this phone number already exists");

  const contact = await WhatsAppContact.create({
    companyId: ctx.companyId,
    name,
    phone,
    email,
    city,
    tags: tags || [],
    optIn: !!optIn,
    optInAt: optIn ? new Date() : undefined,
  });

  return apiSuccess(contact, "Contact created", 201);
}
