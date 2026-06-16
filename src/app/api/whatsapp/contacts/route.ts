import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, paginatedResponse, paginate, apiSuccess } from "@/lib/api-helpers";
import WhatsAppContact from "@/models/WhatsAppContact";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";

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
  if (campaignId) {
    const campaign = await WhatsAppCampaign.findOne({ _id: campaignId, companyId: ctx.companyId }).select("audienceContactIds");
    query._id = { $in: campaign?.audienceContactIds || [] };
  }

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
