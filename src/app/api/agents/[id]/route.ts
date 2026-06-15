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
  const { password, ...rest } = body;

  const updateData: Record<string, unknown> = { ...rest };
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
