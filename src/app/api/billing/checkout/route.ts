import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongodb";
import Plan from "@/models/Plan";

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("your-stripe")) {
    return apiError("Stripe is not configured. Add STRIPE_SECRET_KEY to your .env.local file.", 503);
  }

  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const body = await request.json();
  const { planType, billingCycle = "MONTHLY" } = body;

  const plan = await Plan.findOne({ type: planType, isActive: true });
  if (!plan) return apiError("Plan not found", 404);

  const price = billingCycle === "ANNUALLY" ? plan.price.annually : plan.price.monthly;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" });

  const appUrl = process.env.AUTH_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: (plan.currency || "inr").toLowerCase(),
          product_data: {
            name: `SupportFlow ${plan.name} Plan`,
            description: plan.description,
          },
          unit_amount: price * 100,
          recurring: { interval: billingCycle === "ANNUALLY" ? "year" : "month" },
        },
        quantity: 1,
      },
    ],
    metadata: {
      companyId: ctx.companyId,
      planId:    plan._id.toString(),
      planType:  plan.type,
      billingCycle,
    },
    success_url: `${appUrl}/dashboard/billing?success=1`,
    cancel_url:  `${appUrl}/dashboard/billing?cancelled=1`,
  });

  return apiSuccess({ url: session.url }, "Checkout session created");
}
