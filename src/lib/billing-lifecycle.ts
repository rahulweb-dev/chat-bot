import cron from "node-cron";
import type { Types } from "mongoose";
import { connectDB } from "./mongodb";
import Company from "../models/Company";
import Subscription from "../models/Subscription";
import User from "../models/User";
import Notification from "../models/Notification";
import { sendEmail } from "./email";
import { FREE_LIMITS, RENEWAL_GRACE_MS } from "./plan-limits";

const REMIND_DAYS = 3;

type SubDoc = {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  status: string;
  currentPeriodEnd: Date;
  planId?: { name?: string } | null;
};

function billingUrl() {
  return `${process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/dashboard/billing`;
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function emailShell(heading: string, body: string, cta: string) {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
    <h2 style="color:#4f46e5;margin-top:0">${heading}</h2>
    ${body}
    <a href="${billingUrl()}" style="display:inline-block;background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:20px;font-weight:600">${cta}</a>
  </div>`;
}

// Email + in-app notification to every company admin.
async function notifyAdmins(companyId: Types.ObjectId, title: string, message: string, subject: string, html: string) {
  const admins = await User.find({ companyId, role: "COMPANY_ADMIN" }).select("_id email").lean<{ _id: Types.ObjectId; email?: string }[]>();
  const company = await Company.findById(companyId).select("email").lean<{ email?: string }>();
  const emails = new Set(admins.map((a) => a.email).filter(Boolean) as string[]);
  if (company?.email) emails.add(company.email);

  await Promise.all([
    ...[...emails].map((to) => sendEmail({ to, subject, html }).catch((e) => console.error("[billing-lifecycle] email:", e))),
    ...admins.map((a) =>
      Notification.create({ companyId, userId: a._id, type: "BILLING", title, message, link: "/dashboard/billing", priority: "HIGH" })
        .catch((e) => console.error("[billing-lifecycle] notification:", e))
    ),
  ]);
}

// Only the subscription a company currently points at matters; older,
// superseded ones are history and must not trigger emails.
async function isCurrentSubscription(sub: SubDoc) {
  return !!(await Company.exists({ _id: sub.companyId, subscriptionId: sub._id }));
}

export async function runBillingLifecycle(now = new Date()) {
  await connectDB();
  const soon = new Date(now.getTime() + REMIND_DAYS * 24 * 60 * 60 * 1000);
  let reminded = 0;
  let expired = 0;

  // 1. "Your plan ends in N days" — once per subscription period.
  const ending = await Subscription.find({
    status: { $in: ["ACTIVE", "TRIALING"] },
    currentPeriodEnd: { $gt: now, $lte: soon },
    reminderSentAt: { $exists: false },
    // Auto-renewing plans renew by themselves; no "your plan ends" email.
    $or: [{ autoRenew: { $ne: true } }, { cancelAtPeriodEnd: true }],
  }).populate("planId", "name").lean<SubDoc[]>();

  for (const sub of ending) {
    if (!(await isCurrentSubscription(sub))) continue;
    // Claim it first so a second server instance (or an overlapping run) can't double-send.
    const claimed = await Subscription.findOneAndUpdate(
      { _id: sub._id, reminderSentAt: { $exists: false } },
      { reminderSentAt: now }
    );
    if (!claimed) continue;

    const trial = sub.status === "TRIALING";
    const what = trial ? "free trial" : `${sub.planId?.name ?? "current"} plan`;
    const days = Math.max(1, Math.ceil((new Date(sub.currentPeriodEnd).getTime() - now.getTime()) / 86400000));
    await notifyAdmins(
      sub.companyId,
      `Your ${what} ends in ${days} day${days === 1 ? "" : "s"}`,
      `Renew before ${fmtDate(sub.currentPeriodEnd)} to keep your chatbot running at full capacity.`,
      `Convo360: your ${what} ends on ${fmtDate(sub.currentPeriodEnd)}`,
      emailShell(
        `Your ${what} ends in ${days} day${days === 1 ? "" : "s"}`,
        `<p>Your Convo360 ${what} ends on <b>${fmtDate(sub.currentPeriodEnd)}</b>.</p>
         <p>After that your account moves to the free tier: ${FREE_LIMITS.chats} chats a month, no AI answers and 1 agent. Your data, chatbot and settings are kept.</p>`,
        trial ? "Choose a plan" : "Renew now"
      )
    );
    reminded++;
  }

  // 2. Lapsed: mark PAST_DUE and tell the admins they're on the free tier.
  // Limits already switched the moment the period ended (plan-limits.ts); this
  // is the status cleanup and the email.
  const lapsed = await Subscription.find({
    status: { $in: ["ACTIVE", "TRIALING"] },
    // Auto-renewing plans get RENEWAL_GRACE_MS for the renewal charge to land.
    $or: [
      { $or: [{ autoRenew: { $ne: true } }, { cancelAtPeriodEnd: true }], currentPeriodEnd: { $lte: now } },
      { autoRenew: true, cancelAtPeriodEnd: { $ne: true }, currentPeriodEnd: { $lte: new Date(now.getTime() - RENEWAL_GRACE_MS) } },
    ],
  }).populate("planId", "name").lean<SubDoc[]>();

  for (const sub of lapsed) {
    const claimed = await Subscription.findOneAndUpdate(
      { _id: sub._id, status: { $in: ["ACTIVE", "TRIALING"] } },
      { status: "PAST_DUE", expiryNotifiedAt: now }
    );
    if (!claimed || !(await isCurrentSubscription(sub))) continue;

    const what = sub.status === "TRIALING" ? "free trial" : `${sub.planId?.name ?? ""} plan`.trim();
    await notifyAdmins(
      sub.companyId,
      `Your ${what} has ended`,
      `You're on the free tier now (${FREE_LIMITS.chats} chats/month). Choose a plan to restore full access.`,
      `Convo360: your ${what} has ended`,
      emailShell(
        `Your ${what} has ended`,
        `<p>Your account is now on the free tier: ${FREE_LIMITS.chats} chats a month, no AI answers and 1 agent. Your chatbot still greets visitors and captures leads up to those limits.</p>
         <p>Choose a plan to restore everything instantly. Nothing has been deleted.</p>`,
        "Choose a plan"
      )
    );
    expired++;
  }

  return { reminded, expired };
}

const globalForBilling = globalThis as unknown as { __billingLifecycleScheduler?: boolean };

export function initBillingLifecycleScheduler(): void {
  if (globalForBilling.__billingLifecycleScheduler) return;
  globalForBilling.__billingLifecycleScheduler = true;

  // Hourly: a plan that lapses at 10:05 gets its "ended" email by 11:00, not tomorrow.
  cron.schedule("15 * * * *", async () => {
    try {
      const r = await runBillingLifecycle();
      if (r.reminded || r.expired) console.log("[billing-lifecycle]", r);
    } catch (e) {
      console.error("[billing-lifecycle] tick failed:", e);
    }
  });
}
