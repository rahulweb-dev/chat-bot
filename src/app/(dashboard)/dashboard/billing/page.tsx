"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Zap, Crown, Building, AlertTriangle, CreditCard } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

const plans = [
  {
    type: "STARTER",
    name: "Starter",
    price: { monthly: 2499, annually: 24990 },
    icon: Zap,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    features: ["2 Agents", "1,000 Chats/mo", "500 AI Messages/mo", "1 Chatbot", "Basic Analytics", "Email Support"],
  },
  {
    type: "PRO",
    name: "Pro",
    price: { monthly: 8299, annually: 82990 },
    icon: Crown,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-400",
    popular: true,
    features: ["10 Agents", "10,000 Chats/mo", "5,000 AI Messages/mo", "5 Chatbots", "Advanced Analytics", "CRM & Leads", "API Access", "Priority Support"],
  },
  {
    type: "ENTERPRISE",
    name: "Enterprise",
    price: { monthly: 24999, annually: 249990 },
    icon: Building,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    features: ["Unlimited Agents", "Unlimited Chats", "Unlimited AI Messages", "Unlimited Chatbots", "White Labeling", "Custom Domain", "Dedicated Support", "SLA Guarantee"],
  },
];

export default function BillingPage() {
  const qc = useQueryClient();
  const [billing, setBilling] = useState<"MONTHLY" | "ANNUALLY">("MONTHLY");

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions");
      const d = await res.json();
      return d.data;
    },
  });

  const { data: usageData } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      const d = await res.json();
      return d.data;
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async (planType: string) => {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType, billingCycle: billing }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Plan upgraded successfully!", variant: "default" });
        qc.invalidateQueries({ queryKey: ["subscription"] });
        qc.invalidateQueries({ queryKey: ["usage"] });
      } else {
        toast({ title: data.error || "Failed to upgrade", variant: "destructive" });
      }
    },
  });

  const currentPlan = subscription?.planId?.type || usageData?.plan?.type || "STARTER";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your subscription and usage</p>
      </div>

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
                  {subscription.status === "TRIALING" && subscription.trialEnd && (
                    <span className="text-xs text-gray-500">
                      Trial ends {new Date(subscription.trialEnd).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  ₹{subscription.amount}<span className="text-base font-normal text-gray-500">/mo</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Next billing: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>
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
                      className={`h-1.5 rounded-full transition-all ₹{
                        metric.isExceeded ? "bg-red-500" : metric.isDanger ? "bg-orange-500" : metric.isWarning ? "bg-yellow-500" : "bg-green-500"
                      }`}
                      style={{ width: `₹{Math.min(100, metric.percentage)}%` }}
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
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ₹{billing === "MONTHLY" ? "bg-white shadow font-medium" : "text-gray-500"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("ANNUALLY")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ₹{billing === "ANNUALLY" ? "bg-white shadow font-medium" : "text-gray-500"}`}
            >
              Annual <span className="text-green-600 text-xs ml-1">Save 17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentPlan === plan.type;
            const price = billing === "MONTHLY" ? plan.price.monthly : Math.round(plan.price.annually / 12);

            return (
              <Card
                key={plan.type}
                className={`border-0 shadow-sm relative overflow-hidden ₹{plan.popular ? "ring-2 ring-indigo-400" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                    POPULAR
                  </div>
                )}
                <CardContent className="p-6">
                  <div className={`w-10 h-10 ₹{plan.bg} rounded-lg flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ₹{plan.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="my-3">
                    <span className="text-3xl font-bold">₹{price}</span>
                    <span className="text-gray-500 text-sm">/month</span>
                    {billing === "ANNUALLY" && (
                      <div className="text-xs text-green-600 mt-0.5">Billed ₹{plan.price.annually}/year</div>
                    )}
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className={`w-full ₹{plan.popular ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => upgradeMutation.mutate(plan.type)}
                      disabled={upgradeMutation.isPending}
                    >
                      {upgradeMutation.isPending ? "Processing..." : currentPlan === "ENTERPRISE" ? "Contact Sales" : "Upgrade"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
