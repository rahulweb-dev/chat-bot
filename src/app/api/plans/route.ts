import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Plan from "@/models/Plan";

export async function GET(request: NextRequest) {
  await connectDB();
  const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 });
  return apiSuccess(plans);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();
  const plan = await Plan.create(body);
  return apiSuccess(plan, "Plan created", 201);
}
