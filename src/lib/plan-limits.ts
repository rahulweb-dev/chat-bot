import Company from "@/models/Company";
import Plan from "@/models/Plan";
import Subscription from "@/models/Subscription";

// What a company keeps once its trial or paid period runs out without renewal:
// enough for the widget to keep greeting and capturing a few leads (so the
// customer's site never looks broken), not enough to run a business on.
export const FREE_LIMITS: Record<string, number> = {
  agents: 1,
  chats: 50,
  aiMessages: 0,
  storage: 100,
  knowledgeFiles: 1,
  workflows: 0,
  apiRequests: 500,
  departments: 1,
  chatbots: 1,
  leads: 50,
  tickets: 20,
  emailSends: 0,
  rcsSends: 0,
};

export interface EffectivePlan {
  name: string;
  type: string;
  limits: Record<string, number>;
  expired: boolean;
  periodEnd?: Date;
  autoRenew?: boolean;
}

// Razorpay charges an auto-renewing plan at the end of the period and the
// webhook can land a little later (or after a retried charge). Keep the plan
// active for this long past its end date so customers aren't dropped to the
// free tier for a few hours each month.
export const RENEWAL_GRACE_MS = 3 * 24 * 3_600_000;

export function renewsAutomatically(sub: { autoRenew?: boolean; cancelAtPeriodEnd?: boolean }) {
  return !!sub.autoRenew && !sub.cancelAtPeriodEnd;
}

// The limits that apply to a company right now.
// - company.subscriptionId set (self sign-up trial, or a purchase): that
//   subscription governs; once its period ends, FREE_LIMITS apply. This is
//   checked live against currentPeriodEnd, so it takes effect the moment a plan
//   lapses rather than waiting for the expiry job.
// - no subscriptionId (plan assigned by the super admin by hand): plan limits,
//   with no expiry.
export async function getEffectivePlan(companyId: string): Promise<EffectivePlan | null> {
  const company = await Company.findById(companyId)
    .select("planId subscriptionId")
    .populate({ path: "planId", model: Plan })
    .lean<{ planId?: { name: string; type: string; limits: Record<string, number> } | null; subscriptionId?: unknown }>();
  if (!company) return null;

  const plan = company.planId;
  const base: EffectivePlan = {
    name: plan?.name ?? "Free",
    type: plan?.type ?? "FREE",
    limits: plan?.limits ?? FREE_LIMITS,
    expired: !plan,
  };
  if (!company.subscriptionId) return base;

  const sub = await Subscription.findById(company.subscriptionId)
    .select("status currentPeriodEnd autoRenew cancelAtPeriodEnd")
    .lean<{ status: string; currentPeriodEnd: Date; autoRenew?: boolean; cancelAtPeriodEnd?: boolean }>();
  if (!sub) return base;

  const end = new Date(sub.currentPeriodEnd).getTime() + (renewsAutomatically(sub) ? RENEWAL_GRACE_MS : 0);
  const live = (sub.status === "ACTIVE" || sub.status === "TRIALING") && end > Date.now();
  if (live) return { ...base, periodEnd: sub.currentPeriodEnd, autoRenew: renewsAutomatically(sub) };
  return { name: "Free", type: "FREE", limits: FREE_LIMITS, expired: true, periodEnd: sub.currentPeriodEnd };
}
