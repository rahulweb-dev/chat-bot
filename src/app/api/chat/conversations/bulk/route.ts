import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Conversation from "@/models/Conversation";
import mongoose from "mongoose";

export async function PATCH(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();

  const { ids, action, agentId } = await request.json();
  if (!Array.isArray(ids) || !ids.length) return apiError("ids required", 400);
  if (!action) return apiError("action required", 400);

  const objectIds = ids.map((id: string) => new mongoose.Types.ObjectId(id));
  const query = { _id: { $in: objectIds }, companyId: ctx.companyId };

  let update: Record<string, unknown>;
  if (action === "resolve") {
    update = { $set: { status: "RESOLVED", resolvedAt: new Date() } };
  } else if (action === "close") {
    update = { $set: { status: "CLOSED" } };
  } else if (action === "assign" && agentId) {
    update = { $set: { assignedTo: agentId, status: "ASSIGNED" } };
  } else if (action === "reopen") {
    update = { $set: { status: "OPEN" }, $unset: { assignedTo: "" } };
  } else {
    return apiError("Unknown action or missing agentId for assign", 400);
  }

  const result = await Conversation.updateMany(query, update);
  return apiSuccess({ modified: result.modifiedCount });
}
