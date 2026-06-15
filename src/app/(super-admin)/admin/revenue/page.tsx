"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Loader2, DollarSign, TrendingUp, Users, CreditCard } from "lucide-react";

export default function AdminRevenuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-revenue"],
    queryFn: () => axios.get("/api/admin/revenue").then((r) => r.data.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = data?.stats || {};
  const mrr = stats.mrr || 0;
  const totalRevenue = stats.totalRevenue || 0;
  const activeSubscriptions = stats.activeSubscriptions || 0;
  const avgRevenuePerAccount = activeSubscriptions > 0 ? Math.round(mrr / activeSubscriptions) : 0;
  const revenueByPlan = data?.revenueByPlan || [];
  const monthlyTrend = data?.monthlyTrend || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Revenue Overview</h1>
        <p className="text-muted-foreground">Platform-wide revenue metrics</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Monthly Recurring Revenue", value: `$${mrr.toLocaleString()}`, icon: DollarSign, color: "text-green-500" },
          { label: "Total Revenue (All Time)", value: `$${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-blue-500" },
          { label: "Active Subscriptions", value: activeSubscriptions, icon: CreditCard, color: "text-purple-500" },
          { label: "Avg Revenue / Account", value: `$${avgRevenuePerAccount}`, icon: Users, color: "text-orange-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">MRR Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => [`$${v ?? 0}`, "MRR"]} />
                <Area type="monotone" dataKey="mrr" stroke="#6366f1" fill="url(#mrrGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Plan</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueByPlan}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="plan" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => [`$${v ?? 0}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
