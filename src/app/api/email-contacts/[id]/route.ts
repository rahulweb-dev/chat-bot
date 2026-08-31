import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import EmailContact from "@/models/EmailContact";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const body = await request.json();
  const { name, tags, optIn, assignedTo } = body;

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (tags !== undefined) update.tags = tags;
  if (optIn !== undefined) {
    update.optIn = optIn;
    update[optIn ? "optInAt" : "optOutAt"] = new Date();
  }
  // Only managers+ can reassign — an agent can update their own contacts'
  // details, but not hand them to someone else (or grab someone else's).
  if (assignedTo !== undefined) {
    if (ctx.userRole === "AGENT") return apiError("Forbidden", 403);
    update.assignedTo = assignedTo || null;
  }

  const query: Record<string, unknown> = { _id: id, companyId: ctx.companyId };
  if (ctx.userRole === "AGENT") query.assignedTo = ctx.userId;

  const contact = await EmailContact.findOneAndUpdate(query, { $set: update }, { new: true }).populate("assignedTo", "name");
  if (!contact) return apiError("Not found", 404);

  return apiSuccess(contact, "Contact updated");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);
  if (ctx.userRole === "AGENT") return apiError("Forbidden", 403);

  await connectDB();
  const contact = await EmailContact.findOneAndDelete({ _id: id, companyId: ctx.companyId });
  if (!contact) return apiError("Not found", 404);

  return apiSuccess(null, "Contact deleted");
}
