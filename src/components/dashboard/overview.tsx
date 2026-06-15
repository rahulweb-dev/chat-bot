"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare, Ticket, Tag, TrendingUp, TrendingDown,
  Clock, Star, Users, Zap, AlertTriangle, Bot, Phone,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend,
} from "recharts";
import { formatNumber, getUsageProgressColor } from "@/lib/utils";

interface OverviewProps {
  role: string;
}

interface Lead {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  stage: string;
  source?: string;
  createdAt: string;
}

function calcTrend(arr: { value: number }[] | undefined): number | null {
  if (!arr || arr.length < 4) return null;
  const mid = Math.floor(arr.length / 2);
  const first = arr.slice(0, mid).reduce((s, d) => s + d.value, 0);
  const second = arr.slice(mid).reduce((s, d) => s + d.value, 0);
  if (!first) return null;
  return Math.round(((second - first) / first) * 100);
}

export function DashboardOverview({ role }: OverviewProps) {
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics", "30d"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?range=30d");
      const data = await res.json();
      return data.data;
    },
    enabled: !["AGENT"].includes(role),
  });

  const { data: usageData } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      const data = await res.json();
      return data.data;
    },
  });

  const { data: recentLeads } = useQuery({
    queryKey: ["overview-chatbot-leads"],
    queryFn: async () => {
      const res = await fetch("/api/leads?limit=30");
      const d = await res.json();
      const all: Lead[] = d.data || [];
      return all.filter((l) => l.source === "CHAT_WIDGET").slice(0, 6);
    },
    enabled: !["AGENT"].includes(role),
  });

  const overview = analytics?.overview;
  const trends = analytics?.trends;

  // Today = last data point in trends
  const todayChats   = trends?.chats?.at(-1)?.value ?? null;
  const todayLeads   = trends?.leads?.at(-1)?.value ?? null;
  const todayTickets = trends?.tickets?.at(-1)?.value ?? null;

  // Real trend % from first-half vs second-half of 30d period
  const chatTrend   = calcTrend(trends?.chats);
  const leadTrend   = calcTrend(trends?.leads);
  const ticketTrend = calcTrend(trends?.tickets);

  const statCards = [
    {
      title: "Total Chats",
      value: overview?.totalChats || 0,
      trend: chatTrend,
      icon: MessageSquare,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Open Tickets",
      value: overview?.totalTickets || 0,
      trend: ticketTrend != null ? -ticketTrend : null,
      icon: Ticket,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: "New Leads",
      value: overview?.totalLeads || 0,
      trend: leadTrend,
      icon: Tag,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "CSAT Score",
      value: overview?.csat?.avg ? `${overview.csat.avg}/5` : "N/A",
      trend: null,
      icon: Star,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      title: "Resolution Rate",
      value: `${overview?.chatResolutionRate || 0}%`,
      trend: null,
      icon: TrendingUp,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title: "Avg Response",
      value: `${overview?.avgResponseTime || 0}m`,
      trend: null,
      icon: Clock,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  const chartData = trends?.chats?.map((d: { date: string; value: number }, i: number) => ({
    date: d.date,
    chats: d.value,
    tickets: trends.tickets[i]?.value || 0,
    leads: trends.leads[i]?.value || 0,
  })) || [];

  const stageColors: Record<string, string> = {
    NEW: "bg-gray-100 text-gray-600",
    CONTACTED: "bg-blue-100 text-blue-600",
    QUALIFIED: "bg-indigo-100 text-indigo-600",
    MEETING: "bg-purple-100 text-purple-600",
    PROPOSAL: "bg-orange-100 text-orange-600",
    WON: "bg-green-100 text-green-600",
    LOST: "bg-red-100 text-red-600",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back! Here&apos;s what&apos;s happening.</p>
      </div>

      {role !== "AGENT" && (
        <>
          {/* Today's Activity Banner */}
          {(todayChats !== null || todayLeads !== null) && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Today's Chats", value: todayChats, icon: MessageSquare, color: "text-blue-600 bg-blue-50" },
                { label: "Today's Leads", value: todayLeads, icon: Tag, color: "text-green-600 bg-green-50" },
                { label: "Today's Tickets", value: todayTickets, icon: Ticket, color: "text-orange-600 bg-orange-50" },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="border-0 shadow-sm">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", color.split(" ")[1])}>
                      <Icon className={cn("w-4 h-4", color.split(" ")[0])} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-gray-900">{value ?? "—"}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Main Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              const trendUp = (card.trend ?? 0) >= 0;
              return (
                <Card key={card.title} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {analyticsLoading ? "—" : formatNumber(typeof card.value === "number" ? card.value : 0) || card.value}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{card.title}</p>
                    {card.trend !== null ? (
                      <div className="flex items-center gap-1 mt-2">
                        {trendUp
                          ? <TrendingUp className="w-3 h-3 text-green-500" />
                          : <TrendingDown className="w-3 h-3 text-red-500" />}
                        <span className={cn("text-xs font-medium", trendUp ? "text-green-600" : "text-red-600")}>
                          {trendUp ? "+" : ""}{card.trend}%
                        </span>
                        <span className="text-xs text-gray-400">30d</span>
                      </div>
                    ) : (
                      <div className="mt-2 h-4" />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts + Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Activity Trends (30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="chatsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="chats" stroke="#6366f1" fill="url(#chatsGrad)" strokeWidth={2} name="Chats" />
                    <Area type="monotone" dataKey="leads" stroke="#22c55e" fill="url(#leadsGrad)" strokeWidth={2} name="Leads" />
                    <Line type="monotone" dataKey="tickets" stroke="#f59e0b" strokeWidth={2} dot={false} name="Tickets" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {/* Agent Performance */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Agent Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.agentPerformance?.slice(0, 4).map((agent: { id: string; name: string; chatsHandled: number; resolved: number; avgResponseTime: number }) => (
                    <div key={agent.id} className="flex items-center gap-3 mb-3 last:mb-0">
                      <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                        {agent.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{agent.name}</p>
                        <p className="text-xs text-gray-500">{agent.chatsHandled} chats · {agent.avgResponseTime}m avg</p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">{agent.resolved}</Badge>
                    </div>
                  ))}
                  {(!analytics?.agentPerformance?.length) && (
                    <p className="text-sm text-gray-400 text-center py-3">No agent data yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Recent Chatbot Leads */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Bot className="w-4 h-4 text-indigo-500" />
                    Recent Chatbot Leads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentLeads?.length ? (
                    <div className="space-y-2">
                      {recentLeads.map((lead) => (
                        <div key={lead._id} className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{lead.name}</p>
                            {lead.phone && (
                              <p className="text-xs text-gray-400 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" />{lead.phone}
                              </p>
                            )}
                          </div>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0", stageColors[lead.stage] || "bg-gray-100 text-gray-600")}>
                            {lead.stage}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-3">No chatbot leads yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {usageData && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-500" />
              Usage — {usageData.plan?.name} Plan ({usageData.period})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {usageData.metrics?.map((metric: {
                resource: string; label: string; used: number; limit: number;
                remaining: number; percentage: number; isUnlimited: boolean;
                isWarning: boolean; isDanger: boolean; isExceeded: boolean;
              }) => (
                <div key={metric.resource} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{metric.label}</span>
                    {metric.isExceeded && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    {metric.isDanger && !metric.isExceeded && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                  </div>
                  {metric.isUnlimited ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">{metric.used}</span>
                      <Badge variant="secondary" className="text-xs">Unlimited</Badge>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold text-gray-900">{metric.used}</span>
                        <span className="text-sm text-gray-500">/ {metric.limit}</span>
                      </div>
                      <Progress
                        value={metric.percentage}
                        className={cn("h-1.5", getProgressBg(metric.percentage))}
                      />
                      <p className="text-xs text-gray-500">{metric.percentage}% used · {metric.remaining} remaining</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function getProgressBg(pct: number): string {
  if (pct >= 100) return "[&>div]:bg-red-500";
  if (pct >= 90) return "[&>div]:bg-orange-500";
  if (pct >= 75) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-green-500";
}
