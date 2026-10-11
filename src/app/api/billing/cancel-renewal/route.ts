import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { cancelRazorpaySubscription } from "@/lib/razorpay";
import { endAutoRenew } from "@/lib/billing";
import Company from "@/models/Company";
import Subscription from "@/models/Subscription";
import AuditLog from "@/models/AuditLog";

// Turns off automatic renewal. The plan stays active until the end of the
// period already paid for.
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (ctx.userRole !== "COMPANY_ADMIN") return apiError("Only the company admin can change billing", 403);

  await connectDB();
  const company = await Company.findById(ctx.companyId).select("subscriptionId").lean<{ subscriptionId?: unknown }>();
  const sub = company?.subscriptionId
    ? await Subscription.findById(company.subscriptionId).select("razorpaySubscriptionId autoRenew currentPeriodEnd").lean<{ razorpaySubscriptionId?: string; autoRenew?: boolean; currentPeriodEnd: Date }>()
    : null;
  if (!sub?.razorpaySubscriptionId || !sub.autoRenew) return apiError("Automatic renewal isn't on for this plan", 400);

  try {
    await cancelRazorpaySubscription(sub.razorpaySubscriptionId);
  } catch (e) {
    console.error("[billing] cancel renewal:", e instanceof Error ? e.message : e);
    return apiError("Couldn't reach the payment provider. Please try again in a minute.", 502);
  }
  await endAutoRenew(sub.razorpaySubscriptionId);
  await AuditLog.create({
    companyId: ctx.companyId, userId: ctx.userId, action: "AUTO_RENEW_CANCELLED", resource: "subscription",
    resourceId: sub.razorpaySubscriptionId, status: "SUCCESS",
  }).catch(() => {});

  return apiSuccess({ activeUntil: sub.currentPeriodEnd }, "Automatic renewal turned off");
}
