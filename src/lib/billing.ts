import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import Subscription from "@/models/Subscription";
import Company from "@/models/Company";
import AuditLog from "@/models/AuditLog";
import Plan from "@/models/Plan";
import { createRazorpayPlan, toMinorUnits } from "@/lib/razorpay";

// Turns a paid order into an active plan. Called from both the browser callback
// (/api/billing/verify) and the Razorpay webhook — whichever arrives first does
// the work; the other finds the payment already PAID and returns it unchanged.
export async function activatePaidOrder(orderId: string, paymentId: string) {
  await connectDB();

  // Atomic CREATED/FAILED -> PAID flip: exactly one caller wins this update.
  const payment = await Payment.findOneAndUpdate(
    { orderId, status: { $ne: "PAID" } },
    { status: "PAID", paymentId, paidAt: new Date(), $unset: { failureReason: 1 } },
    { new: true }
  );
  if (!payment) return Payment.findOne({ orderId });

  const now = new Date();
  // Paying again for the same plan before it runs out adds time on top of what's
  // left instead of throwing the remaining days away. A trial or different plan
  // starts fresh today.
  const current = await Subscription.findOne({
    companyId: payment.companyId,
    status: "ACTIVE",
    planId: payment.planId,
    currentPeriodEnd: { $gt: now },
  }).sort({ currentPeriodEnd: -1 });

  const start = current ? current.currentPeriodEnd : now;
  const end = new Date(start);
  if (payment.billingCycle === "ANNUALLY") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);

  await Subscription.updateMany(
    { companyId: payment.companyId, status: { $in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
    { status: "INACTIVE" }
  );

  const subscription = await Subscription.create({
    companyId: payment.companyId,
    planId: payment.planId,
    status: "ACTIVE",
    billingCycle: payment.billingCycle,
    currentPeriodStart: current ? current.currentPeriodStart : now,
    currentPeriodEnd: end,
    nextBillingDate: end,
    amount: payment.amount,
    currency: payment.currency,
    metadata: { provider: payment.provider, orderId, paymentId },
    // A Razorpay subscription's first payment is stored with orderId = "sub_…".
    ...(orderId.startsWith("sub_") ? { autoRenew: true, razorpaySubscriptionId: orderId } : {}),
  });

  await Company.findByIdAndUpdate(payment.companyId, {
    planId: payment.planId,
    subscriptionId: subscription._id,
  });

  payment.subscriptionId = subscription._id;
  await payment.save();

  await AuditLog.create({
    companyId: payment.companyId,
    userId: payment.userId,
    action: "PLAN_PURCHASED",
    resource: "subscription",
    resourceId: String(subscription._id),
    details: { orderId, paymentId, amount: payment.amount, currency: payment.currency, billingCycle: payment.billingCycle },
    status: "SUCCESS",
  }).catch(() => {});

  return payment;
}

// ── Automatic renewal (Razorpay Subscriptions) ──────────────────────────────────

// Razorpay plan for this Plan × cycle at its current price; created once and
// cached on the Plan. A price change makes a new one (existing subscribers stay
// on the price they signed up at, as Razorpay requires).
export async function ensureRazorpayPlan(planId: string, cycle: "MONTHLY" | "ANNUALLY") {
  await connectDB();
  const plan = await Plan.findById(planId);
  if (!plan) throw new Error("Plan not found");
  const amount = cycle === "ANNUALLY" ? plan.price.annually : plan.price.monthly;
  const key = cycle === "ANNUALLY" ? "annually" : "monthly";
  const cached = plan.razorpayPlan?.[key];
  if (cached?.planId && cached.amount === amount) return cached.planId;

  const created = await createRazorpayPlan({
    name: `Convo360 ${plan.name} (${cycle === "ANNUALLY" ? "yearly" : "monthly"})`,
    amountMinor: toMinorUnits(amount),
    currency: (plan.currency || "INR").toUpperCase(),
    cycle,
  });
  await Plan.updateOne({ _id: plan._id }, { $set: { [`razorpayPlan.${key}`]: { planId: created.id, amount } } });
  return created.id;
}

// A renewal charge on an auto-renewing subscription (webhook subscription.charged).
// The first charge is the one activatePaidOrder already handled; later ones
// extend the period. Each payment id is applied once.
export async function applySubscriptionCharge(rzpSubscriptionId: string, paymentId: string, periodEndUnix?: number) {
  await connectDB();
  const first = await Payment.findOne({ orderId: rzpSubscriptionId });
  if (!first) return null; // not ours (another integration on the same Razorpay account)
  if (first.status !== "PAID") return activatePaidOrder(rzpSubscriptionId, paymentId);
  if (first.paymentId === paymentId) return first; // the initial charge, already applied

  // Unique orderId makes the renewal record the idempotency guard.
  const renewal = await Payment.create({
    companyId: first.companyId, userId: first.userId, planId: first.planId, billingCycle: first.billingCycle,
    amount: first.amount, currency: first.currency, provider: first.provider,
    orderId: `${rzpSubscriptionId}:${paymentId}`, paymentId, status: "PAID", paidAt: new Date(),
  }).catch(() => null);
  if (!renewal) return null; // duplicate webhook delivery

  const sub = await Subscription.findOne({ razorpaySubscriptionId: rzpSubscriptionId }).sort({ createdAt: -1 });
  if (!sub) return renewal;
  let end: Date;
  if (periodEndUnix) end = new Date(periodEndUnix * 1000);
  else {
    end = new Date(Math.max(Date.now(), sub.currentPeriodEnd.getTime()));
    if (sub.billingCycle === "ANNUALLY") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
  }
  await Subscription.updateOne(
    { _id: sub._id },
    { $set: { status: "ACTIVE", currentPeriodEnd: end, nextBillingDate: end }, $unset: { reminderSentAt: 1, expiryNotifiedAt: 1 } }
  );
  // The company may have been dropped to the free tier during a late renewal.
  await Company.updateOne({ _id: sub.companyId }, { planId: sub.planId, subscriptionId: sub._id });
  await Payment.updateOne({ _id: renewal._id }, { subscriptionId: sub._id });

  await AuditLog.create({
    companyId: sub.companyId, action: "PLAN_RENEWED", resource: "subscription", resourceId: String(sub._id),
    details: { rzpSubscriptionId, paymentId, periodEnd: end }, status: "SUCCESS",
  }).catch(() => {});
  return renewal;
}

// Auto-renew switched off (by the customer, or Razorpay gave up after failed
// charges): keep what's paid for, stop at period end.
export async function endAutoRenew(rzpSubscriptionId: string) {
  await connectDB();
  await Subscription.updateMany(
    { razorpaySubscriptionId: rzpSubscriptionId },
    { $set: { autoRenew: false, cancelAtPeriodEnd: true, cancelledAt: new Date() } }
  );
}

export async function markOrderFailed(orderId: string, reason?: string) {
  await connectDB();
  // Never downgrade a PAID order: Razorpay can send a failed attempt's event
  // after a later retry on the same order succeeded.
  await Payment.findOneAndUpdate(
    { orderId, status: "CREATED" },
    { status: "FAILED", failureReason: reason?.slice(0, 300) }
  );
}
