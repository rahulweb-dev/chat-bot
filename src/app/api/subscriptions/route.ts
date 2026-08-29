import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, rateLimitError, ipKey } from "@/lib/rate-limit";
import Subscription from "@/models/Subscription";
import Company from "@/models/Company";
import Plan from "@/models/Plan";

const createSubscriptionSchema = z.object({
  planType: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
  billingCycle: z.enum(["MONTHLY", "ANNUALLY"]).default("MONTHLY"),
  companyId: z.string().length(24),
});

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const subscription = await Subscription.findOne({
    companyId: ctx.companyId,
    status: { $in: ["ACTIVE", "TRIALING"] },
  })
    .populate({ path: "planId", model: Plan })
    .sort({ createdAt: -1 });

  return apiSuccess(subscription);
}

// Activating a subscription is a billing action, not self-service: there's no real
// payment step yet, so only SUPER_ADMIN can grant a plan — mirroring the existing
// manual "email us to upgrade" flow on the billing page, which SUPER_ADMIN already
// fulfills via PATCH /api/companies/[id]. This endpoint is an alternate path to the
// same manual grant, done through the API instead of the company-edit form.
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  // Rate-limit: max 10 subscription changes per hour per IP
  if (!(await rateLimit(ipKey(request, "create-subscription"), 10, 60 * 60 * 1000))) {
    return rateLimitError();
  }

  await connectDB();
  const raw = await request.json();
  const parsed = createSubscriptionSchema.safeParse(raw);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  const { planType, billingCycle, companyId } = parsed.data;

  const plan = await Plan.findOne({ type: planType });
  if (!plan) return apiError("Plan not found");

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === "MONTHLY") {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  // Deactivate existing subscriptions for this company
  await Subscription.updateMany({ companyId }, { status: "INACTIVE" });

  const subscription = await Subscription.create({
    companyId,
    planId: plan._id,
    status: "ACTIVE",
    billingCycle,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    // Amount always sourced from the plan — never trusted from the client
    amount: billingCycle === "MONTHLY" ? plan.price.monthly : plan.price.annually,
    currency: plan.currency || "INR",
  });

  await Company.findByIdAndUpdate(companyId, {
    planId: plan._id,
    subscriptionId: subscription._id,
  });

  return apiSuccess(subscription, "Subscription created", 201);
}
