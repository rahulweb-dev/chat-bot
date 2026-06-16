import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import WhatsAppMessage from "@/models/WhatsAppMessage";
import WhatsAppConversation from "@/models/WhatsAppConversation";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const companyId = new mongoose.Types.ObjectId(ctx.companyId);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [messagesToday, activeConversations, deliveryAgg, campaigns] = await Promise.all([
    WhatsAppMessage.countDocuments({ companyId, createdAt: { $gte: startOfToday } }),
    WhatsAppConversation.countDocuments({ companyId, status: { $in: ["OPEN", "PENDING"] } }),
    WhatsAppMessage.aggregate([
      { $match: { companyId, direction: "OUTBOUND" } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $in: ["$status", ["DELIVERED", "READ"]] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ["$status", "READ"] }, 1, 0] } },
        },
      },
    ]),
    WhatsAppCampaign.find({ companyId }).sort({ createdAt: -1 }).limit(10).select("name status stats createdAt"),
  ]);

  const agg = deliveryAgg[0] || { total: 0, delivered: 0, read: 0 };
  const deliveryRate = agg.total ? Math.round((agg.delivered / agg.total) * 100) : 0;
  const readRate = agg.total ? Math.round((agg.read / agg.total) * 100) : 0;

  return apiSuccess({
    messagesToday,
    activeConversations,
    deliveryRate,
    readRate,
    campaigns,
  });
}
