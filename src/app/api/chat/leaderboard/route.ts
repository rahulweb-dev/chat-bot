import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Conversation from "@/models/Conversation";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const companyId = new mongoose.Types.ObjectId(ctx.companyId);

  const rows = await Conversation.aggregate([
    { $match: { companyId, createdAt: { $gte: since }, assignedTo: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: "$assignedTo",
        total: { $sum: 1 },
        resolved: { $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0] } },
        avgCsat: { $avg: "$csat.rating" },
        avgFirstResponseMs: {
          $avg: {
            $cond: [
              { $and: ["$firstResponseAt", "$createdAt"] },
              { $subtract: ["$firstResponseAt", "$createdAt"] },
              null,
            ],
          },
        },
      },
    },
    { $sort: { resolved: -1 } },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "agent",
      },
    },
    { $unwind: { path: "$agent", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        agentId: "$_id",
        name: "$agent.name",
        email: "$agent.email",
        avatar: "$agent.avatar",
        isOnline: "$agent.isOnline",
        total: 1,
        resolved: 1,
        avgCsat: { $round: ["$avgCsat", 1] },
        avgFirstResponseMin: {
          $round: [{ $divide: [{ $ifNull: ["$avgFirstResponseMs", 0] }, 60000] }, 0],
        },
      },
    },
  ]);

  return apiSuccess(rows);
}
