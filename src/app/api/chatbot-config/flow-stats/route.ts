import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Lead from "@/models/Lead";
import Ticket from "@/models/Ticket";

// Counts how many Leads/Tickets each custom-flow menu option has generated,
// grouped by the "type" marker finalizeCustomFlow() stamps onto leadData/
// ticketData (the flow's leadType, or its key.toUpperCase() as a fallback).
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const companyId = new mongoose.Types.ObjectId(ctx.companyId);

  const [leadCounts, ticketCounts] = await Promise.all([
    Lead.aggregate([
      { $match: { companyId, "customFields.type": { $exists: true, $ne: null } } },
      { $group: { _id: "$customFields.type", count: { $sum: 1 } } },
    ]),
    Ticket.aggregate([
      { $match: { companyId, "customFields.type": { $exists: true, $ne: null } } },
      { $group: { _id: "$customFields.type", count: { $sum: 1 } } },
    ]),
  ]);

  const counts: Record<string, number> = {};
  for (const row of leadCounts as { _id: string; count: number }[]) counts[row._id] = (counts[row._id] || 0) + row.count;
  for (const row of ticketCounts as { _id: string; count: number }[]) counts[row._id] = (counts[row._id] || 0) + row.count;

  return apiSuccess(counts);
}
