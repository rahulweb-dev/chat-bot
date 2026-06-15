import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Subscription from "@/models/Subscription";
import Company from "@/models/Company";
import Plan from "@/models/Plan";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const subscription = await Subscription.findOne({ companyId: ctx.companyId, status: { $in: ["ACTIVE", "TRIALING"] } })
    .populate("planId")
    .sort({ createdAt: -1 });

  return apiSuccess(subscription);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();
  const { planType, billingCycle = "MONTHLY", companyId = ctx.companyId } = body;

  const plan = await Plan.findOne({ type: planType });
  if (!plan) return apiError("Plan not found");

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === "MONTHLY") {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  await Subscription.updateMany({ companyId }, { status: "INACTIVE" });

  const subscription = await Subscription.create({
    companyId,
    planId: plan._id,
    status: "ACTIVE",
    billingCycle,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    amount: billingCycle === "MONTHLY" ? plan.price.monthly : plan.price.annually,
    currency: plan.currency || "USD",
  });

  await Company.findByIdAndUpdate(companyId, {
    planId: plan._id,
    subscriptionId: subscription._id,
  });

  return apiSuccess(subscription, "Subscription created", 201);
}
