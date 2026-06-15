"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Crown, Users, MessageSquare, Brain, Check } from "lucide-react";

export default function AdminPlansPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => axios.get("/api/plans").then((r) => r.data.data),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      axios.patch(`/api/plans/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-plans"] }),
  });

  const togglePopular = useMutation({
    mutationFn: ({ id, isPopular }: { id: string; isPopular: boolean }) =>
      axios.patch(`/api/plans/${id}`, { isPopular }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-plans"] }),
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
                <span className="text-3xl font-bold">${plan.price.monthly}</span>
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
                  <span>Active</span>
                  <Switch
                    checked={plan.isActive}
                    onCheckedChange={(checked) => toggle.mutate({ id: plan._id, isActive: checked })}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Popular badge</span>
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
