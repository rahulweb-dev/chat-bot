import { NextRequest } from "next/server";
import mongoose, { Model as MongooseModel, PipelineStage } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { requireSuperAdminForCompany, isAdminContextError } from "@/lib/admin-helpers";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";
import RCSCampaignRecipient from "@/models/RCSCampaignRecipient";
import EmailCampaignRecipient from "@/models/EmailCampaignRecipient";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import RCSCampaign from "@/models/RCSCampaign";
import EmailCampaign from "@/models/EmailCampaign";
import WhatsAppContact from "@/models/WhatsAppContact";
import RCSContact from "@/models/RCSContact";
import EmailContact from "@/models/EmailContact";

type Channel = "WHATSAPP" | "RCS" | "EMAIL";
const ALL_CHANNELS: Channel[] = ["WHATSAPP", "RCS", "EMAIL"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CHANNEL_MODELS: Record<Channel, { recipient: MongooseModel<any>; campaign: MongooseModel<any>; contact: MongooseModel<any>; contactField: "phone" | "email" }> = {
  WHATSAPP: { recipient: WhatsAppCampaignRecipient, campaign: WhatsAppCampaign, contact: WhatsAppContact, contactField: "phone" },
  RCS: { recipient: RCSCampaignRecipient, campaign: RCSCampaign, contact: RCSContact, contactField: "phone" },
  EMAIL: { recipient: EmailCampaignRecipient, campaign: EmailCampaign, contact: EmailContact, contactField: "email" },
};

// Company-wide recipient list across every campaign on every channel — one row per
// (campaign, contact) pair. Paginated and sorted at the DB level via $unionWith +
// $facet instead of pulling every recipient into memory first, which doesn't scale
// once a company has more than a few thousand recipients.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSuperAdminForCompany(request, id);
  if (isAdminContextError(ctx)) return apiError(ctx.error, ctx.status);

  const { searchParams } = new URL(request.url);
  const channelParam = (searchParams.get("channel") || "").toUpperCase();
  const channels: Channel[] = ALL_CHANNELS.includes(channelParam as Channel) ? [channelParam as Channel] : ALL_CHANNELS;
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50")));

  await connectDB();
  const companyId = new mongoose.Types.ObjectId(id);

  const subPipeline = (ch: Channel): PipelineStage[] => {
    const { campaign, contact, contactField } = CHANNEL_MODELS[ch];
    const match: Record<string, unknown> = { companyId };
    if (status) match.status = status;
    if (search) match[contactField] = { $regex: search, $options: "i" };
    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) range.$gte = new Date(dateFrom);
      if (dateTo) range.$lte = new Date(dateTo);
      match.createdAt = range;
    }
    return [
      { $match: match },
      { $lookup: { from: campaign.collection.name, localField: "campaignId", foreignField: "_id", as: "_campaign" } },
      { $lookup: { from: contact.collection.name, localField: "contactId", foreignField: "_id", as: "_contact" } },
      {
        $project: {
          _id: 1,
          campaignId: 1,
          contactId: 1,
          status: 1,
          phone: 1,
          email: 1,
          sentAt: 1,
          deliveredAt: 1,
          readAt: 1,
          openedAt: 1,
          clickedAt: 1,
          createdAt: 1,
          channel: { $literal: ch },
          campaignName: { $ifNull: [{ $arrayElemAt: ["$_campaign.name", 0] }, "—"] },
          contactName: { $arrayElemAt: ["$_contact.name", 0] },
        },
      },
    ];
  };

  const [base, ...rest] = channels;
  const pipeline: PipelineStage[] = [...subPipeline(base)];
  for (const ch of rest) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pipeline.push({ $unionWith: { coll: CHANNEL_MODELS[ch].recipient.collection.name, pipeline: subPipeline(ch) as any } });
  }
  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({
    $facet: {
      items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      totalCount: [{ $count: "count" }],
    },
  });

  const [result] = await CHANNEL_MODELS[base].recipient.aggregate(pipeline);
  const items = result?.items || [];
  const total = result?.totalCount?.[0]?.count || 0;

  return apiSuccess({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
}
