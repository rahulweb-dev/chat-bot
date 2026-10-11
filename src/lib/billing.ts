import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import Subscription from "@/models/Subscription";
import Company from "@/models/Company";
import AuditLog from "@/models/AuditLog";

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

export async function markOrderFailed(orderId: string, reason?: string) {
  await connectDB();
  // Never downgrade a PAID order: Razorpay can send a failed attempt's event
  // after a later retry on the same order succeeded.
  await Payment.findOneAndUpdate(
    { orderId, status: "CREATED" },
    { status: "FAILED", failureReason: reason?.slice(0, 300) }
  );
}
