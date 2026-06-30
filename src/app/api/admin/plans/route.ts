import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Plan from "@/models/Plan";
import Company from "@/models/Company";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  await connectDB();

  const [plans, companyCounts] = await Promise.all([
    Plan.find({}).sort({ sortOrder: 1 }),
    Company.aggregate([{ $group: { _id: "$planId", count: { $sum: 1 } } }]),
  ]);

  const countMap = Object.fromEntries(
    (companyCounts as { _id: unknown; count: number }[]).map((c) => [String(c._id), c.count])
  );

  return apiSuccess(
    plans.map((p) => ({ ...p.toObject(), companyCount: countMap[p._id.toString()] ?? 0 }))
  );
}
