import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { rateLimit, rateLimitError } from "@/lib/rate-limit";
import { createOrder, razorpayConfigured, toMinorUnits } from "@/lib/razorpay";
import Plan from "@/models/Plan";
import Payment from "@/models/Payment";
import User from "@/models/User";
import Company from "@/models/Company";

const checkoutSchema = z.object({
  planType: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
  billingCycle: z.enum(["MONTHLY", "ANNUALLY"]).default("MONTHLY"),
});

// Starts a plan purchase: creates a Razorpay order for the plan's price and
// returns what the browser needs to open Razorpay Checkout.
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (ctx.userRole !== "COMPANY_ADMIN") return apiError("Only the company admin can change the plan", 403);

  if (!razorpayConfigured()) return apiError("Online payments aren't set up yet. Please contact support to upgrade.", 503);

  if (!(await rateLimit(`billing-checkout:${ctx.userId}`, 10, 60 * 60 * 1000))) return rateLimitError();

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);
  const { planType, billingCycle } = parsed.data;

  await connectDB();
  const plan = await Plan.findOne({ type: planType, isActive: true });
  if (!plan) return apiError("Plan not found", 404);

  // Price always comes from the Plan in the database, never from the client.
  const amount = billingCycle === "ANNUALLY" ? plan.price.annually : plan.price.monthly;
  if (!amount || amount <= 0) return apiError("This plan can't be bought online. Please contact sales.", 400);
  const currency = (plan.currency || "INR").toUpperCase();

  let order;
  try {
    order = await createOrder({
      amountMinor: toMinorUnits(amount),
      currency,
      receipt: `c${ctx.companyId.slice(-8)}-${Date.now()}`, // Razorpay caps receipts at 40 chars
      notes: { companyId: ctx.companyId, planType, billingCycle },
    });
  } catch (err) {
    console.error("[billing] Razorpay order failed:", err instanceof Error ? err.message : err);
    return apiError("Couldn't start the payment. Please try again in a minute.", 502);
  }

  await Payment.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    planId: plan._id,
    billingCycle,
    amount,
    currency,
    orderId: order.id,
  });

  const [user, company] = await Promise.all([
    User.findById(ctx.userId).select("name email phone").lean<{ name?: string; email?: string; phone?: string }>(),
    Company.findById(ctx.companyId).select("name").lean<{ name?: string }>(),
  ]);

  return apiSuccess({
    keyId: process.env.RAZORPAY_KEY_ID,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    planName: plan.name,
    billingCycle,
    companyName: company?.name,
    prefill: { name: user?.name, email: user?.email, contact: user?.phone },
  });
}
