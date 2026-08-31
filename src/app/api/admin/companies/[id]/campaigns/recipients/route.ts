import { NextRequest } from "next/server";
import { Model as MongooseModel } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { apiError, paginatedResponse, paginate } from "@/lib/api-helpers";
import { requireSuperAdminForCompany, isAdminContextError } from "@/lib/admin-helpers";
import WhatsAppCampaignRecipient from "@/models/WhatsAppCampaignRecipient";
import RCSCampaignRecipient from "@/models/RCSCampaignRecipient";
import EmailCampaignRecipient from "@/models/EmailCampaignRecipient";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import RCSCampaign from "@/models/RCSCampaign";
import EmailCampaign from "@/models/EmailCampaign";

// Cast to loose Model<any> maps — see the per-campaign recipients route for why.
/* eslint-disable @typescript-eslint/no-explicit-any */
const MODELS: Record<string, MongooseModel<any>> = { WHATSAPP: WhatsAppCampaignRecipient, RCS: RCSCampaignRecipient, EMAIL: EmailCampaignRecipient };
const CAMPAIGN_MODELS: Record<string, MongooseModel<any>> = { WHATSAPP: WhatsAppCampaign, RCS: RCSCampaign, EMAIL: EmailCampaign };
/* eslint-enable @typescript-eslint/no-explicit-any */
type Channel = "WHATSAPP" | "RCS" | "EMAIL";
const ALL_CHANNELS: Channel[] = ["WHATSAPP", "RCS", "EMAIL"];

// Company-wide recipient list across every campaign on every channel — one row per
// (campaign, contact) pair, the same shape the per-campaign recipients route uses
// plus a campaign name. Joined manually (not via populate) since campaignId isn't
// guaranteed to carry a Mongoose ref to the right model per channel.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSuperAdminForCompany(request, id);
  if (isAdminContextError(ctx)) return apiError(ctx.error, ctx.status);

  const { searchParams } = new URL(request.url);
  const channelParam = (searchParams.get("channel") || "").toUpperCase();
  const channels: Channel[] = ALL_CHANNELS.includes(channelParam as Channel) ? [channelParam as Channel] : ALL_CHANNELS;
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  await connectDB();

  const perChannel = await Promise.all(
    channels.map(async (channel) => {
      const Model = MODELS[channel];
      const query: Record<string, unknown> = { companyId: id };
      if (status) query.status = status;
      if (search) {
        const field = channel === "EMAIL" ? "email" : "phone";
        query[field] = { $regex: search, $options: "i" };
      }
      const docs = await Model.find(query).populate("contactId", "name").sort({ createdAt: -1 }).lean();
      return docs.map((d) => ({ ...d, channel }));
    })
  );

  const flat = perChannel.flat();

  // Attach campaign names in one batch query per channel instead of N+1.
  const campaignIdsByChannel: Record<Channel, Set<string>> = { WHATSAPP: new Set(), RCS: new Set(), EMAIL: new Set() };
  for (const r of flat) campaignIdsByChannel[r.channel as Channel].add(String((r as { campaignId: unknown }).campaignId));

  const campaignNameMaps = await Promise.all(
    channels.map(async (channel) => {
      const ids = [...campaignIdsByChannel[channel]];
      if (!ids.length) return new Map<string, string>();
      const campaigns = await CAMPAIGN_MODELS[channel].find({ _id: { $in: ids } }).select("name").lean();
      return new Map(campaigns.map((c) => [String(c._id), c.name]));
    })
  );
  const nameByChannel = Object.fromEntries(channels.map((c, i) => [c, campaignNameMaps[i]])) as Record<Channel, Map<string, string>>;

  const withCampaignName = flat
    .map((r) => ({ ...r, campaignName: nameByChannel[r.channel as Channel].get(String((r as { campaignId: unknown }).campaignId)) || "—" }))
    .sort((a, b) => new Date((b as { createdAt: Date }).createdAt).getTime() - new Date((a as { createdAt: Date }).createdAt).getTime());

  const total = withCampaignName.length;
  const { skip } = paginate(page, limit);
  const items = withCampaignName.slice(skip, skip + limit);

  return paginatedResponse(items, total, page, limit);
}
