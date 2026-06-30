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
  // Only SUPER_ADMIN may supply companyId; for everyone else it is ignored
  companyId: z.string().length(24).optional(),
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

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  // Rate-limit: max 10 subscription changes per hour per IP
  if (!rateLimit(ipKey(request, "create-subscription"), 10, 60 * 60 * 1000)) {
    return rateLimitError();
  }

  await connectDB();
  const raw = await request.json();
  const parsed = createSubscriptionSchema.safeParse(raw);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  const { planType, billingCycle } = parsed.data;

  // SUPER_ADMIN may act on behalf of any company; everyone else is locked to their own
  const companyId =
    ctx.userRole === "SUPER_ADMIN" && parsed.data.companyId
      ? parsed.data.companyId
      : ctx.companyId;

  if (!companyId) return apiError("Company required", 400);

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
