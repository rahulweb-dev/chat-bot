import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Lead from "@/models/Lead";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { id } = await params;
  await connectDB();

  const lead = await Lead.findOne({ _id: id, companyId: ctx.companyId })
    .populate("assignedTo", "name email avatar");
  if (!lead) return apiError("Lead not found", 404);

  return apiSuccess(lead);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { id } = await params;
  await connectDB();

  // Strip companyId/_id so a request can't re-parent a lead into a different
  // tenant (or spoof its id) just by including those fields in the body —
  // the filter below only controls which document is found, not what an
  // update is allowed to write.
  const { companyId: _companyId, _id: _ignoredId, ...body } = await request.json();
  if (body.stage === "WON" || body.stage === "LOST") {
    body.closedAt = new Date();
  }

  const lead = await Lead.findOneAndUpdate(
    { _id: id, companyId: ctx.companyId },
    body,
    { new: true }
  ).populate("assignedTo", "name email avatar");

  if (!lead) return apiError("Lead not found", 404);
  return apiSuccess(lead, "Lead updated");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  const { id } = await params;
  await connectDB();

  await Lead.findOneAndDelete({ _id: id, companyId: ctx.companyId });
  return apiSuccess(null, "Lead deleted");
}
