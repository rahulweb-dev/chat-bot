"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Building, AlertTriangle, Loader2, CreditCard } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCardsSkeleton } from "@/components/ui/page-skeletons";

// Look of each plan card. Prices and features come from the Plan collection
// (/api/plans) so the price shown is exactly the price charged at checkout.
const PLAN_STYLE: Record<string, { icon: typeof Zap; color: string; bg: string; features: string[] }> = {
  STARTER: {
    icon: Zap, color: "text-blue-600", bg: "bg-blue-50",
    features: ["2 Agents", "1,000 Chats/mo", "500 AI Messages/mo", "1 Chatbot", "Basic Analytics", "Email Support"],
  },
  PRO: {
    icon: Crown, color: "text-indigo-600", bg: "bg-indigo-50",
    features: ["10 Agents", "10,000 Chats/mo", "5,000 AI Messages/mo", "5 Chatbots", "Advanced Analytics", "CRM & Leads", "API Access", "Priority Support"],
  },
  ENTERPRISE: {
    icon: Building, color: "text-purple-600", bg: "bg-purple-50",
    features: ["Unlimited Agents", "Unlimited Chats", "Unlimited AI Messages", "Unlimited Chatbots", "White Labeling", "Custom Domain", "Dedicated Support", "SLA Guarantee"],
  },
};

type DbPlan = {
  _id: string;
  type: "STARTER" | "PRO" | "ENTERPRISE";
  name: string;
  price: { monthly: number; annually: number };
  currency?: string;
  features?: string[];
  isPopular?: boolean;
};

type RazorpayInstance = { open: () => void; on: (event: string, cb: (r: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance }
}

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function money(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export default function BillingPage() {
  const [billing, setBilling] = useState<"MONTHLY" | "ANNUALLY">("MONTHLY");
  const [paying, setPaying] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "COMPANY_ADMIN";

  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions");
      const d = await res.json();
      return d.data;
    },
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      const d = await res.json();
      return d.data;
    },
  });

  const { data: dbPlans, isLoading: plansLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      const d = await res.json();
      return (d.data || []) as DbPlan[];
    },
  });

  const handleUpgrade = async (plan: DbPlan) => {
    setPaying(plan.type);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: plan.type, billingCycle: billing }),
      });
      const d = await res.json();
      if (!d.success) {
        toast({ title: "Couldn't start payment", description: d.error, variant: "destructive" });
        setPaying(null);
        return;
      }
      if (!(await loadRazorpay()) || !window.Razorpay) {
        toast({ title: "Payment window didn't load", description: "Check your connection or ad blocker and try again.", variant: "destructive" });
        setPaying(null);
        return;
      }
      const o = d.data;
      const rzp = new window.Razorpay({
        key: o.keyId,
        order_id: o.orderId,
        amount: o.amount,
        currency: o.currency,
        name: "Convo360",
        description: `${o.planName} plan · ${o.billingCycle === "ANNUALLY" ? "1 year" : "1 month"}`,
        prefill: o.prefill,
        notes: { company: o.companyName },
        theme: { color: "#4f46e5" },
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const v = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
          }).then((x) => x.json()).catch(() => null);
          setPaying(null);
          if (v?.success) {
            toast({ title: `You're on ${o.planName}`, description: "Your new limits are active now." });
          } else {
            // Payment went through at Razorpay; the webhook will still activate the plan.
            toast({ title: "Payment received", description: "Your plan will update within a minute. Refresh if it doesn't." });
          }
          qc.invalidateQueries({ queryKey: ["subscription"] });
          qc.invalidateQueries({ queryKey: ["usage"] });
        },
        modal: { ondismiss: () => setPaying(null) },
      });
      rzp.on("payment.failed", (r) => {
        toast({ title: "Payment failed", description: r.error?.description || "No money was taken. Please try again.", variant: "destructive" });
      });
      rzp.open();
    } catch {
      toast({ title: "Couldn't start payment", description: "Please try again.", variant: "destructive" });
      setPaying(null);
    }
  };

  const currentPlan = subscription?.planId?.type || usageData?.plan?.type || "STARTER";
  const isTrial = subscription?.status === "TRIALING";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your subscription and usage</p>
      </div>

      {subscriptionLoading && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="h-7 w-24 ml-auto" />
                <Skeleton className="h-3 w-36 ml-auto" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {subscription && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Current Plan</p>
                <h2 className="text-2xl font-bold text-gray-900 mt-1">{subscription.planId?.name || currentPlan}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={subscription.status === "ACTIVE" ? "success" : subscription.status === "TRIALING" ? "info" : "warning"}>
                    {subscription.status}
                  </Badge>
                  {isTrial && subscription.trialEnd && (
                    <span className="text-xs text-gray-500">
                      Trial ends {new Date(subscription.trialEnd).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {money(subscription.amount, subscription.currency)}
                  <span className="text-base font-normal text-gray-500">{subscription.billingCycle === "ANNUALLY" ? "/yr" : "/mo"}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {isTrial ? "Trial ends" : "Paid until"} {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {usageLoading && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-500" /> Current Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatCardsSkeleton count={4} />
          </CardContent>
        </Card>
      )}

      {usageData && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-500" /> Current Usage ({usageData.period})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {usageData.metrics?.filter((m: { isUnlimited: boolean }) => !m.isUnlimited).slice(0, 8).map((metric: {
                resource: string; label: string; used: number; limit: number;
                percentage: number; isWarning: boolean; isDanger: boolean; isExceeded: boolean;
              }) => (
                <div key={metric.resource} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{metric.label}</span>
                    {metric.isExceeded && <AlertTriangle className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold">{metric.used}</span>
                    <span className="text-sm text-gray-400">/ {metric.limit}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        metric.isExceeded ? "bg-red-500" : metric.isDanger ? "bg-orange-500" : metric.isWarning ? "bg-yellow-500" : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(100, metric.percentage)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">{metric.percentage}% used</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Choose a Plan</h2>
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setBilling("MONTHLY")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${billing === "MONTHLY" ? "bg-white shadow font-medium" : "text-gray-500"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("ANNUALLY")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${billing === "ANNUALLY" ? "bg-white shadow font-medium" : "text-gray-500"}`}
            >
              Annual <span className="text-green-600 text-xs ml-1">Save 17%</span>
            </button>
          </div>
        </div>

        {plansLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-96 rounded-xl" />)}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dbPlans?.map((plan) => {
            const style = PLAN_STYLE[plan.type] || PLAN_STYLE.STARTER;
            const Icon = style.icon;
            const features = plan.features?.length ? plan.features : style.features;
            const currency = plan.currency || "INR";
            // Same plan, but upgrading from a trial or renewing early, is still a valid purchase.
            const isCurrent = currentPlan === plan.type && !isTrial;
            const price = billing === "MONTHLY" ? plan.price.monthly : Math.round(plan.price.annually / 12);
            const busy = paying === plan.type;

            return (
              <Card
                key={plan._id}
                className={`border-0 shadow-sm relative overflow-hidden ${plan.isPopular ? "ring-2 ring-indigo-400" : ""}`}
              >
                {plan.isPopular && (
                  <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                    POPULAR
                  </div>
                )}
                <CardContent className="p-6">
                  <div className={`w-10 h-10 ${style.bg} rounded-lg flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${style.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="my-3">
                    <span className="text-3xl font-bold">{money(price, currency)}</span>
                    <span className="text-gray-500 text-sm">/month</span>
                    {billing === "ANNUALLY" && (
                      <div className="text-xs text-green-600 mt-0.5">Billed {money(plan.price.annually, currency)}/year</div>
                    )}
                  </div>
                  <ul className="space-y-2 mb-6">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={!isAdmin || !!paying}
                      onClick={() => handleUpgrade(plan)}
                    >
                      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Current Plan · Renew
                    </Button>
                  ) : (
                    <Button
                      className={`w-full ${plan.isPopular ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                      variant={plan.isPopular ? "default" : "outline"}
                      disabled={!isAdmin || !!paying}
                      onClick={() => handleUpgrade(plan)}
                    >
                      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                      {isTrial && currentPlan === plan.type ? `Buy ${plan.name}` : `Upgrade to ${plan.name}`}
                    </Button>
                  )}
                  {!isAdmin && (
                    <p className="text-xs text-gray-400 mt-2 text-center">Only your company admin can change the plan.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {!plansLoading && !dbPlans?.length && (
          <p className="text-sm text-gray-500">No plans are available right now. Please contact support.</p>
        )}
      </div>
    </div>
  );
}
