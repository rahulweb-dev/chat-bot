import { NextRequest } from "next/server";
import mongoose, { PipelineStage } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { requireSuperAdminForCompany, isAdminContextError } from "@/lib/admin-helpers";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import RCSCampaign from "@/models/RCSCampaign";
import EmailCampaign from "@/models/EmailCampaign";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";
import WhatsAppContact from "@/models/WhatsAppContact";
import WhatsAppConversation from "@/models/WhatsAppConversation";

type Channel = "WHATSAPP" | "RCS" | "EMAIL";

interface NormalizedCampaign {
  _id: string;
  channel: Channel;
  name: string;
  status: string;
  recipients: number;
  sent: number;
  delivered: number;
  failed: number;
  readOrOpened: number;
  clicked: number;
  replies: number | null; // null = not tracked for this channel, not "zero replies"
  createdAt: string;
  scheduledAt?: string;
  sentAt?: string;
}

// Projects every channel's campaign doc into one shared shape directly inside the
// aggregation, so the DB does the merge/sort/paginate instead of us pulling every
// matching campaign into memory first (the old approach didn't scale past a few
// hundred campaigns per company).
const PROJECT_STAGE: PipelineStage.Project = {
  $project: {
    _id: 1,
    channel: 1,
    name: 1,
    status: 1,
    recipients: { $ifNull: ["$stats.total", 0] },
    sent: { $ifNull: ["$stats.sent", 0] },
    delivered: { $ifNull: ["$stats.delivered", 0] },
    failed: { $ifNull: ["$stats.failed", 0] },
    readOrOpened: { $ifNull: ["$stats.read", { $ifNull: ["$stats.opened", 0] }] },
    clicked: { $ifNull: ["$stats.clicked", 0] },
    createdAt: 1,
    scheduledAt: 1,
    sentAt: "$startedAt",
  },
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSuperAdminForCompany(request, id);
  if (isAdminContextError(ctx)) return apiError(ctx.error, ctx.status);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel"); // "WHATSAPP" | "RCS" | "EMAIL" | null (all)
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20")));

  const companyId = new mongoose.Types.ObjectId(id);
  const match: Record<string, unknown> = { companyId };
  if (status) match.status = status;
  if (search) match.name = { $regex: search, $options: "i" };
  if (dateFrom || dateTo) {
    const range: Record<string, Date> = {};
    if (dateFrom) range.$gte = new Date(dateFrom);
    if (dateTo) range.$lte = new Date(dateTo);
    match.createdAt = range;
  }

  const wantWhatsApp = !channel || channel === "WHATSAPP";
  const wantRcs = !channel || channel === "RCS";
  const wantEmail = !channel || channel === "EMAIL";

  type Wanted = { model: typeof WhatsAppCampaign | typeof RCSCampaign | typeof EmailCampaign; channel: Channel };
  const wanted: Wanted[] = [
    ...(wantWhatsApp ? [{ model: WhatsAppCampaign, channel: "WHATSAPP" as Channel }] : []),
    ...(wantRcs ? [{ model: RCSCampaign, channel: "RCS" as Channel }] : []),
    ...(wantEmail ? [{ model: EmailCampaign, channel: "EMAIL" as Channel }] : []),
  ];
  if (wanted.length === 0) return apiError("channel must be WHATSAPP, RCS, or EMAIL", 400);

  const subPipeline = (channelLabel: Channel): PipelineStage[] => [
    { $match: match },
    { $addFields: { channel: channelLabel } },
    PROJECT_STAGE,
  ];

  const [base, ...rest] = wanted;
  const pipeline: PipelineStage[] = [...subPipeline(base.channel)];
  for (const w of rest) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pipeline.push({ $unionWith: { coll: w.model.collection.name, pipeline: subPipeline(w.channel) as any } });
  }
  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({
    $facet: {
      items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      totalCount: [{ $count: "count" }],
    },
  });

  const [result] = await base.model.aggregate(pipeline);
  const rawItems = (result?.items || []) as Array<Omit<NormalizedCampaign, "_id" | "replies" | "createdAt" | "scheduledAt" | "sentAt"> & {
    _id: mongoose.Types.ObjectId;
    createdAt: Date;
    scheduledAt?: Date;
    sentAt?: Date;
  }>;
  const total = result?.totalCount?.[0]?.count || 0;

  const repliesByCampaign = await computeWhatsAppReplyCounts(
    companyId,
    rawItems.filter((c) => c.channel === "WHATSAPP").map((c) => c._id)
  );

  const items: NormalizedCampaign[] = rawItems.map((c) => ({
    ...c,
    _id: String(c._id),
    createdAt: c.createdAt?.toISOString?.() || String(c.createdAt || ""),
    scheduledAt: c.scheduledAt?.toISOString?.(),
    sentAt: c.sentAt?.toISOString?.(),
    replies: c.channel === "WHATSAPP" ? repliesByCampaign.get(String(c._id)) ?? 0 : null,
  }));

  return apiSuccess({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

// Batched (one aggregation for the whole page, not one query per row) count of
// distinct contacts per campaign who have a WhatsApp conversation with activity
// after they were sent that campaign — the same "engaged back" heuristic used by
// the per-campaign replies route, just grouped instead of listed. RCS and Email
// get `replies: null` from the caller since neither channel captures inbound
// replies at all (see the dedicated replies routes for why) — that's deliberately
// different from `0`, which would claim "tracked, and nobody replied."
async function computeWhatsAppReplyCounts(companyId: mongoose.Types.ObjectId, campaignIds: mongoose.Types.ObjectId[]): Promise<Map<string, number>> {
  if (campaignIds.length === 0) return new Map();

  const rows = await WhatsAppCampaignRecipient.aggregate([
    { $match: { campaignId: { $in: campaignIds }, companyId } },
    { $lookup: { from: WhatsAppContact.collection.name, localField: "contactId", foreignField: "_id", as: "contact" } },
    { $unwind: "$contact" },
    {
      $lookup: {
        from: WhatsAppConversation.collection.name,
        let: { phone: "$contact.phone", sentAt: "$sentAt" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$companyId", companyId] },
                  { $eq: ["$customerPhone", "$$phone"] },
                  { $gte: ["$lastMessageAt", { $ifNull: ["$$sentAt", new Date(0)] }] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "conv",
      },
    },
    { $match: { "conv.0": { $exists: true } } },
    { $group: { _id: "$campaignId", repliedContacts: { $addToSet: "$contactId" } } },
    { $project: { campaignId: "$_id", count: { $size: "$repliedContacts" } } },
  ]);

  return new Map(rows.map((r) => [String(r.campaignId), r.count as number]));
}
