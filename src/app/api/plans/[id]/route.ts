import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Plan from "@/models/Plan";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectDB();
  const plan = await Plan.findById(id);
  if (!plan) return apiError("Not found", 404);
  return apiSuccess(plan);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();
  const plan = await Plan.findByIdAndUpdate(id, { $set: body }, { new: true });
  if (!plan) return apiError("Not found", 404);

  return apiSuccess(plan, "Plan updated");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  await connectDB();
  await Plan.findByIdAndDelete(id);
  return apiSuccess(null, "Plan deleted");
}
