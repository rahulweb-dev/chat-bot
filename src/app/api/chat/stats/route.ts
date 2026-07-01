import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Conversation from "@/models/Conversation";
import User from "@/models/User";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const companyId = new mongoose.Types.ObjectId(ctx.companyId);

  const [openChats, pendingChats, resolvedToday, onlineAgents, openConvs] = await Promise.all([
    Conversation.countDocuments({ companyId, status: "OPEN" }),
    Conversation.countDocuments({ companyId, status: "PENDING" }),
    Conversation.countDocuments({ companyId, status: "RESOLVED", resolvedAt: { $gte: today } }),
    User.countDocuments({
      companyId,
      isOnline: true,
      isActive: true,
      role: { $in: ["AGENT", "MANAGER", "TEAM_LEADER", "COMPANY_ADMIN"] },
    }),
    Conversation.find({ companyId, status: { $in: ["OPEN", "PENDING"] } })
      .select("lastMessageAt createdAt")
      .lean<{ lastMessageAt?: Date; createdAt: Date }[]>(),
  ]);

  const now = Date.now();
  const avgWaitMs =
    openConvs.length > 0
      ? openConvs.reduce((sum, c) => {
          const ref = c.lastMessageAt || c.createdAt;
          return sum + (now - new Date(ref).getTime());
        }, 0) / openConvs.length
      : 0;
  const avgWaitMinutes = Math.round(avgWaitMs / 60_000);

  return apiSuccess({
    openChats,
    pendingChats,
    resolvedToday,
    onlineAgents,
    avgWaitMinutes,
    totalActive: openChats + pendingChats,
  });
}
