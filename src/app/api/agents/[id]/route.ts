import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import User from "@/models/User";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { id } = await params;
  await connectDB();

  const agent = await User.findOne({ _id: id, companyId: ctx.companyId }).select("-password");
  if (!agent) return apiError("Agent not found", 404);

  return apiSuccess(agent);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  const { id } = await params;
  await connectDB();

  const body = await request.json();
  // Strip fields this route must never let the caller set directly:
  // - companyId: prevents re-parenting an agent into a different tenant by
  //   just including it in the PATCH body (the query below only scopes
  //   which document can be found, not what the update can write).
  // - password: handled separately below so it's always hashed.
  const { password, companyId: _companyId, ...rest } = body;

  const updateData: Record<string, unknown> = { ...rest };
  // This endpoint manages the non-admin "agents" roster (same set GET already
  // restricts its listing to) — never let a MANAGER/COMPANY_ADMIN grant
  // SUPER_ADMIN/COMPANY_ADMIN through here, which would be a backdoor to
  // create a full admin account with only "manage my team" permissions.
  if ("role" in updateData) {
    const allowedRoles = ["AGENT", "MANAGER", "TEAM_LEADER", "VIEWER"];
    if (!allowedRoles.includes(updateData.role as string)) {
      return apiError("Invalid role", 400);
    }
  }
  if (password) {
    const bcrypt = await import("bcryptjs");
    updateData.password = await bcrypt.hash(password, 12);
  }

  const agent = await User.findOneAndUpdate(
    { _id: id, companyId: ctx.companyId },
    updateData,
    { new: true }
  ).select("-password");

  if (!agent) return apiError("Agent not found", 404);

  return apiSuccess(agent, "Agent updated");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  const { id } = await params;
  await connectDB();

  const agent = await User.findOneAndDelete({ _id: id, companyId: ctx.companyId });
  if (!agent) return apiError("Agent not found", 404);

  return apiSuccess(null, "Agent deleted");
}
