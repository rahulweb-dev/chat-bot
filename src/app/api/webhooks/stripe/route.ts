import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { connectDB } from "@/lib/mongodb";
import Subscription from "@/models/Subscription";
import Company from "@/models/Company";
import Plan from "@/models/Plan";
import { sendEmail } from "@/lib/email";
import User from "@/models/User";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" });

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("your-stripe")) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig  = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await connectDB();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.companyId;
      const planId    = session.metadata?.planId;
      if (!companyId || !planId) break;

      const plan = await Plan.findById(planId);
      if (!plan) break;

      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const sub = await Subscription.findOneAndUpdate(
        { companyId },
        {
          planId,
          status:              "ACTIVE",
          stripeCustomerId:    session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          currentPeriodStart:  new Date(),
          currentPeriodEnd:    periodEnd,
          amount:              (session.amount_total ?? 0) / 100,
          currency:            session.currency?.toUpperCase() || "INR",
          billingCycle:        session.metadata?.billingCycle || "MONTHLY",
        },
        { upsert: true, new: true }
      );

      await Company.findByIdAndUpdate(companyId, { planId, subscriptionId: sub._id });

      // Email the admin
      const admin = await User.findOne({ companyId, role: "COMPANY_ADMIN" }).select("email name");
      if (admin?.email) {
        await sendEmail({
          to: admin.email,
          subject: `✅ Subscription activated — ${plan.name} plan`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#6366f1">Subscription Activated!</h2>
            <p>Hi ${admin.name},</p>
            <p>Your <strong>${plan.name}</strong> plan is now active.</p>
            <p>Your next billing date is <strong>${periodEnd.toLocaleDateString()}</strong>.</p>
            <a href="${process.env.AUTH_URL}/dashboard/billing"
               style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px">
              View Billing
            </a>
          </div>`,
        }).catch(() => {});
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubId = (invoice as unknown as { subscription?: string }).subscription;
      if (!stripeSubId) break;

      const periodEnd = new Date(invoice.period_end * 1000);
      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: stripeSubId },
        { status: "ACTIVE", currentPeriodEnd: periodEnd }
      );
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubId = (invoice as unknown as { subscription?: string }).subscription;
      if (!stripeSubId) break;

      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: stripeSubId },
        { status: "PAST_DUE" }
      );

      const sub = await Subscription.findOne({ stripeSubscriptionId: stripeSubId });
      if (sub) {
        const admin = await User.findOne({ companyId: sub.companyId, role: "COMPANY_ADMIN" }).select("email name");
        if (admin?.email) {
          await sendEmail({
            to: admin.email,
            subject: "⚠️ Payment failed — action required",
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#ef4444">Payment Failed</h2>
              <p>Hi ${admin.name},</p>
              <p>We could not process your subscription payment. Please update your payment method.</p>
              <a href="${process.env.AUTH_URL}/dashboard/billing"
                 style="display:inline-block;background:#ef4444;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px">
                Update Payment Method
              </a>
            </div>`,
          }).catch(() => {});
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: sub.id },
        { status: "CANCELLED" }
      );
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription & { current_period_end?: number };
      const status = sub.status === "active" ? "ACTIVE"
        : sub.status === "past_due" ? "PAST_DUE"
        : sub.status === "canceled" ? "CANCELLED"
        : "ACTIVE";
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : undefined;
      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: sub.id },
        { status, ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}) }
      );
      break;
    }
  }

  return NextResponse.json({ received: true });
}
