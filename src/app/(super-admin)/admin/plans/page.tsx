"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Crown, Users, MessageSquare, Brain, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function AdminPlansPage() {
  const queryClient = useQueryClient();

  // Deliberately /api/admin/plans, not the public /api/plans: the latter only
  // returns isActive plans, and this page has an "Active" toggle right on each
  // card — using the public endpoint means switching a plan off makes it vanish
  // from the only screen that can switch it back on.
  const { data, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => axios.get("/api/admin/plans").then((r) => r.data.data),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      axios.patch(`/api/plans/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-plans"] }),
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to update plan";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const togglePopular = useMutation({
    mutationFn: ({ id, isPopular }: { id: string; isPopular: boolean }) =>
      axios.patch(`/api/plans/${id}`, { isPopular }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-plans"] }),
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to update plan";
      toast({ title: msg, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const plans = data || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plan Management</h1>
        <p className="text-muted-foreground">Configure pricing plans and limits</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan: {
          _id: string;
          name: string;
          type: string;
          price: { monthly: number; annually: number };
          limits: Record<string, number>;
          features: string[];
          isActive: boolean;
          isPopular: boolean;
        }) => (
          <Card key={plan._id} className="relative">
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary">Most Popular</Badge>
              </div>
            )}
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className={`h-5 w-5 ${plan.type === "ENTERPRISE" ? "text-yellow-500" : plan.type === "PRO" ? "text-blue-500" : "text-gray-500"}`} />
                  <CardTitle>{plan.name}</CardTitle>
                </div>
                <Badge variant={plan.isActive ? "active" : "inactive"}>
                  {plan.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div>
                <span className="text-3xl font-bold">₹{plan.price.monthly.toLocaleString()}</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{plan.limits.agents === -1 ? "∞" : plan.limits.agents} agents</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  <span>{plan.limits.chats === -1 ? "∞" : plan.limits.chats.toLocaleString()} chats</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Brain className="h-3 w-3" />
                  <span>{plan.limits.aiMessages === -1 ? "∞" : plan.limits.aiMessages.toLocaleString()} AI</span>
                </div>
              </div>

              <div className="space-y-1">
                {plan.features.slice(0, 4).map((f: string) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={plan.isActive}
                    aria-label={plan.isActive ? "Deactivate plan" : "Activate plan"}
                    disabled={toggle.isPending && toggle.variables?.id === plan._id}
                    onClick={() => toggle.mutate({ id: plan._id, isActive: !plan.isActive })}
                    className={`
                      inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border
                      transition-colors duration-200 shadow-sm
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-400
                      disabled:cursor-not-allowed disabled:opacity-60
                      ${plan.isActive
                        ? "bg-emerald-50 border-emerald-200 hover:border-emerald-300"
                        : "bg-rose-50/70 border-rose-200/80 hover:border-rose-300"
                      }
                    `}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200 ${plan.isActive ? "bg-emerald-500" : "bg-rose-400"}`} />
                    <span className={`text-[11px] font-medium tracking-wide transition-colors duration-200 w-12 text-left ${plan.isActive ? "text-emerald-700" : "text-rose-500"}`}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full ml-0.5 transition-colors duration-200 ${plan.isActive ? "bg-emerald-500" : "bg-gray-300"}`}>
                      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ease-out ${plan.isActive ? "translate-x-3.5" : "translate-x-0.5"}`} />
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Popular badge</span>
                  <Switch
                    checked={plan.isPopular}
                    onCheckedChange={(checked) => togglePopular.mutate({ id: plan._id, isPopular: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
