import { NextRequest } from "next/server";
import { Model as MongooseModel } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { apiError, paginatedResponse, paginate } from "@/lib/api-helpers";
import { requireSuperAdminForCompany, isAdminContextError } from "@/lib/admin-helpers";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";
import RCSCampaignRecipient from "@/models/RCSCampaignRecipient";
import EmailCampaignRecipient from "@/models/EmailCampaignRecipient";

// Cast to a loose Model<any> map — the three recipient schemas differ enough that
// TS can't unify a Mongoose Model union's overloaded query methods, and this route
// only ever uses one concrete model per request (picked by `channel`) anyway.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODELS: Record<string, MongooseModel<any>> = { WHATSAPP: WhatsAppCampaignRecipient, RCS: RCSCampaignRecipient, EMAIL: EmailCampaignRecipient };
type Channel = "WHATSAPP" | "RCS" | "EMAIL";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  const { id, campaignId } = await params;
  const ctx = await requireSuperAdminForCompany(request, id);
  if (isAdminContextError(ctx)) return apiError(ctx.error, ctx.status);

  const { searchParams } = new URL(request.url);
  const channel = (searchParams.get("channel") || "").toUpperCase() as Channel;
  const Model = MODELS[channel];
  if (!Model) return apiError("channel must be WHATSAPP, RCS, or EMAIL", 400);

  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  await connectDB();
  const query: Record<string, unknown> = { campaignId, companyId: id };
  if (status) query.status = status;
  if (search) {
    const contactField = channel === "EMAIL" ? "email" : "phone";
    query[contactField] = { $regex: search, $options: "i" };
  }

  const { skip } = paginate(page, limit);
  const [recipients, total] = await Promise.all([
    Model.find(query).populate("contactId", "name").skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
    Model.countDocuments(query),
  ]);

  return paginatedResponse(recipients, total, page, limit);
}
