import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Conversation from "@/models/Conversation";
import Ticket from "@/models/Ticket";
import Lead from "@/models/Lead";
import Message from "@/models/Message";
import User from "@/models/User";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (ctx.userRole === "AGENT") return apiError("Forbidden", 403);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "30d";
  const startDate = getStartDate(range);
  // Aggregation pipelines do not cast strings to ObjectId the way find/count do,
  // so a string companyId silently matched nothing (empty charts, agent stats, CSAT).
  const cid = new Types.ObjectId(ctx.companyId);

  const [
    totalChats, resolvedChats, openChats,
    totalTickets, resolvedTickets,
    totalLeads, wonLeads,
    totalMessages,
    chatsByDay, ticketsByDay, leadsByDay,
    agentPerformance,
    csatData,
  ] = await Promise.all([
    Conversation.countDocuments({ companyId: cid, createdAt: { $gte: startDate } }),
    Conversation.countDocuments({ companyId: cid, status: "RESOLVED", createdAt: { $gte: startDate } }),
    Conversation.countDocuments({ companyId: cid, status: "OPEN" }),
    Ticket.countDocuments({ companyId: cid, createdAt: { $gte: startDate } }),
    Ticket.countDocuments({ companyId: cid, status: "RESOLVED", createdAt: { $gte: startDate } }),
    Lead.countDocuments({ companyId: cid, createdAt: { $gte: startDate } }),
    Lead.countDocuments({ companyId: cid, stage: "WON", createdAt: { $gte: startDate } }),
    Message.countDocuments({ companyId: cid, createdAt: { $gte: startDate } }),
    Conversation.aggregate([
      { $match: { companyId: cid, createdAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Ticket.aggregate([
      { $match: { companyId: cid, createdAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Lead.aggregate([
      { $match: { companyId: cid, createdAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Conversation.aggregate([
      { $match: { companyId: cid, assignedTo: { $exists: true }, createdAt: { $gte: startDate } } },
      { $group: {
        _id: "$assignedTo",
        chatsHandled: { $sum: 1 },
        avgResponseTime: { $avg: { $subtract: ["$firstResponseAt", "$createdAt"] } },
        resolved: { $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0] } },
      }},
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "agent" } },
      { $unwind: { path: "$agent", preserveNullAndEmptyArrays: true } },
      { $limit: 10 },
    ]),
    Conversation.aggregate([
      { $match: { companyId: cid, "csat.rating": { $exists: true }, createdAt: { $gte: startDate } } },
      { $group: { _id: null, avg: { $avg: "$csat.rating" }, total: { $sum: 1 } } },
    ]),
  ]);

  const avgResponseTime = await Conversation.aggregate([
    { $match: { companyId: cid, firstResponseAt: { $exists: true }, createdAt: { $gte: startDate } } },
    { $group: { _id: null, avg: { $avg: { $subtract: ["$firstResponseAt", "$createdAt"] } } } },
  ]);

  // Which ads / campaigns / sites the period's leads came from. Leads from
  // before source tracking, or added by hand, land in "Not tracked".
  const leadsByChannel = await Lead.aggregate([
    { $match: { companyId: cid, createdAt: { $gte: startDate } } },
    { $group: {
      _id: { $ifNull: ["$attribution.channel", "Not tracked"] },
      leads: { $sum: 1 },
      won: { $sum: { $cond: [{ $eq: ["$stage", "WON"] }, 1, 0] } },
    }},
    { $sort: { leads: -1 } },
    { $limit: 12 },
  ]);

  return apiSuccess({
    overview: {
      totalChats,
      resolvedChats,
      openChats,
      chatResolutionRate: totalChats > 0 ? Math.round((resolvedChats / totalChats) * 100) : 0,
      totalTickets,
      resolvedTickets,
      ticketResolutionRate: totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0,
      totalLeads,
      wonLeads,
      leadConversionRate: totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0,
      totalMessages,
      avgResponseTime: avgResponseTime[0]?.avg ? Math.round(avgResponseTime[0].avg / 60000) : 0,
      csat: csatData[0] ? { avg: Math.round(csatData[0].avg * 10) / 10, total: csatData[0].total } : { avg: 0, total: 0 },
    },
    trends: {
      chats: chatsByDay.map((d: { _id: string; count: number }) => ({ date: d._id, value: d.count })),
      tickets: ticketsByDay.map((d: { _id: string; count: number }) => ({ date: d._id, value: d.count })),
      leads: leadsByDay.map((d: { _id: string; count: number }) => ({ date: d._id, value: d.count })),
    },
    leadsByChannel: leadsByChannel.map((c: { _id: string; leads: number; won: number }) => ({ channel: c._id, leads: c.leads, won: c.won })),
    agentPerformance: agentPerformance.map((a) => ({
      id: a._id,
      name: a.agent?.name || "Unknown",
      avatar: a.agent?.avatar,
      chatsHandled: a.chatsHandled,
      resolved: a.resolved,
      avgResponseTime: a.avgResponseTime ? Math.round(a.avgResponseTime / 60000) : 0,
    })),
  });
}

function getStartDate(range: string): Date {
  const now = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
