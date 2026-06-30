"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare, TicketIcon, Tag, TrendingUp, TrendingDown,
  Clock, Star, Zap, AlertTriangle, Bot, Phone,
  ArrowUpRight, Plus, UserPlus,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from "recharts";
import { formatNumber, getUsageProgressColor } from "@/lib/utils";

interface OverviewProps { role: string }
interface Lead { _id: string; name: string; phone?: string; email?: string; stage: string; source?: string; createdAt: string }

function calcTrend(arr: { value: number }[] | undefined): number | null {
  if (!arr || arr.length < 4) return null;
  const mid = Math.floor(arr.length / 2);
  const first  = arr.slice(0, mid).reduce((s, d) => s + d.value, 0);
  const second = arr.slice(mid).reduce((s, d) => s + d.value, 0);
  if (!first) return null;
  return Math.round(((second - first) / first) * 100);
}

const STAGE_COLORS: Record<string, string> = {
  NEW:       "bg-gray-100 text-gray-600",
  CONTACTED: "bg-blue-100 text-blue-600",
  QUALIFIED: "bg-indigo-100 text-indigo-600",
  MEETING:   "bg-purple-100 text-purple-600",
  PROPOSAL:  "bg-orange-100 text-orange-600",
  WON:       "bg-green-100 text-green-600",
  LOST:      "bg-red-100 text-red-600",
};

export function DashboardOverview({ role }: OverviewProps) {
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics", "30d"],
    queryFn: async () => {
      const r = await fetch("/api/analytics?range=30d");
      return r.json().then(d => d.data);
    },
    enabled: !["AGENT"].includes(role),
  });

  const { data: usageData } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const r = await fetch("/api/usage");
      return r.json().then(d => d.data);
    },
  });

  const { data: recentLeads } = useQuery({
    queryKey: ["overview-chatbot-leads"],
    queryFn: async () => {
      const r = await fetch("/api/leads?limit=30");
      const all: Lead[] = r.ok ? (await r.json()).data || [] : [];
      return all.filter(l => l.source === "CHAT_WIDGET").slice(0, 6);
    },
    enabled: !["AGENT"].includes(role),
  });

  const overview = analytics?.overview;
  const trends   = analytics?.trends;

  const todayChats   = trends?.chats?.at(-1)?.value   ?? null;
  const todayLeads   = trends?.leads?.at(-1)?.value   ?? null;
  const todayTickets = trends?.tickets?.at(-1)?.value ?? null;

  const chatTrend   = calcTrend(trends?.chats);
  const leadTrend   = calcTrend(trends?.leads);
  const ticketTrend = calcTrend(trends?.tickets);

  const statCards = [
    { title: "Total Chats",      value: overview?.totalChats   || 0, trend: chatTrend,                          icon: MessageSquare, color: "text-blue-600",   bg: "bg-blue-50",   accent: "border-blue-200"  },
    { title: "Open Tickets",     value: overview?.totalTickets || 0, trend: ticketTrend != null ? -ticketTrend : null, icon: TicketIcon,    color: "text-orange-600", bg: "bg-orange-50", accent: "border-orange-200"},
    { title: "New Leads",        value: overview?.totalLeads   || 0, trend: leadTrend,                          icon: Tag,           color: "text-green-600",  bg: "bg-green-50",  accent: "border-green-200" },
    { title: "CSAT Score",       value: overview?.csat?.avg ? `${overview.csat.avg}/5` : "N/A", trend: null,   icon: Star,          color: "text-yellow-600", bg: "bg-yellow-50", accent: "border-yellow-200"},
    { title: "Resolution Rate",  value: `${overview?.chatResolutionRate || 0}%`, trend: null,                  icon: TrendingUp,    color: "text-indigo-600", bg: "bg-indigo-50", accent: "border-indigo-200"},
    { title: "Avg Response",     value: `${overview?.avgResponseTime || 0}m`,    trend: null,                  icon: Clock,         color: "text-purple-600", bg: "bg-purple-50", accent: "border-purple-200"},
  ];

  const chartData = trends?.chats?.map((d: { date: string; value: number }, i: number) => ({
    date: d.date,
    chats: d.value,
    tickets: trends.tickets[i]?.value || 0,
    leads: trends.leads[i]?.value || 0,
  })) || [];

  const isStarterPlan = usageData?.plan?.type === "STARTER";

  return (
    <div className="space-y-6">

      {/* Welcome row + quick actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{role === "AGENT" ? "" : ""}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Here&apos;s what&apos;s happening today.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200" asChild>
            <Link href="/dashboard/chat"><MessageSquare className="w-3.5 h-3.5 mr-1.5" />Live Chat</Link>
          </Button>
          <Button size="sm" variant="outline" className="border-gray-200 hover:bg-gray-50" asChild>
            <Link href="/dashboard/tickets"><Plus className="w-3.5 h-3.5 mr-1.5" />New Ticket</Link>
          </Button>
          <Button size="sm" variant="outline" className="border-gray-200 hover:bg-gray-50" asChild>
            <Link href="/dashboard/leads"><UserPlus className="w-3.5 h-3.5 mr-1.5" />Add Lead</Link>
          </Button>
        </div>
      </div>

      {/* Enterprise upgrade banner */}
      {isStarterPlan && (
        <div className="flex items-center gap-4 bg-linear-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-4">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-md shadow-indigo-200">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Upgrade to Enterprise</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Unlimited agents, white-label branding, dedicated support, advanced analytics & SLA guarantees.
            </p>
          </div>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 shrink-0" asChild>
            <Link href="/dashboard/billing">
              Upgrade <ArrowUpRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      )}

      {role !== "AGENT" && (
        <>
          {/* Today's Activity */}
          {(todayChats !== null || todayLeads !== null) && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Today's Chats",   value: todayChats,   icon: MessageSquare, colorText: "text-blue-600",   colorBg: "bg-blue-50",   border: "border-blue-100"   },
                { label: "Today's Leads",   value: todayLeads,   icon: Tag,           colorText: "text-green-600",  colorBg: "bg-green-50",  border: "border-green-100"  },
                { label: "Today's Tickets", value: todayTickets, icon: TicketIcon,    colorText: "text-orange-600", colorBg: "bg-orange-50", border: "border-orange-100" },
              ].map(({ label, value, icon: Icon, colorText, colorBg, border }) => (
                <Card key={label} className={`border ${border} bg-white shadow-none`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorBg}`}>
                      <Icon className={`w-5 h-5 ${colorText}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 30-day Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {statCards.map((card) => {
              const Icon = card.icon;
              const trendUp = (card.trend ?? 0) >= 0;
              return (
                <Card key={card.title} className="bg-white border border-gray-100 shadow-none hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                      <Icon className={`w-4.5 h-4.5 ${card.color}`} />
                    </div>
                    <p className="text-xl font-bold text-gray-900">
                      {analyticsLoading
                        ? <span className="inline-block w-10 h-5 bg-gray-100 rounded animate-pulse" />
                        : typeof card.value === "number" ? formatNumber(card.value) : card.value}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{card.title}</p>
                    {card.trend !== null ? (
                      <div className="flex items-center gap-1 mt-1.5">
                        {trendUp
                          ? <TrendingUp className="w-3 h-3 text-green-500" />
                          : <TrendingDown className="w-3 h-3 text-red-500" />}
                        <span className={cn("text-[11px] font-semibold", trendUp ? "text-green-600" : "text-red-600")}>
                          {trendUp ? "+" : ""}{card.trend}%
                        </span>
                        <span className="text-[10px] text-gray-400">30d</span>
                      </div>
                    ) : <div className="mt-1.5 h-4" />}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Charts + Side panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Activity chart */}
            <Card className="lg:col-span-2 bg-white border border-gray-100 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-800">Activity Trends (30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="chatsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="chats"   stroke="#6366f1" fill="url(#chatsGrad)" strokeWidth={2} name="Chats"   dot={false} />
                    <Area type="monotone" dataKey="leads"   stroke="#22c55e" fill="url(#leadsGrad)" strokeWidth={2} name="Leads"   dot={false} />
                    <Line type="monotone" dataKey="tickets" stroke="#f59e0b" strokeWidth={2} dot={false} name="Tickets" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {/* Agent Performance */}
              <Card className="bg-white border border-gray-100 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-800">Agent Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analytics?.agentPerformance?.slice(0, 4).map((agent: {
                    id: string; name: string; chatsHandled: number; resolved: number; avgResponseTime: number
                  }) => (
                    <div key={agent.id} className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                        {agent.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-800">{agent.name}</p>
                        <p className="text-xs text-gray-400">{agent.chatsHandled} chats · {agent.avgResponseTime}m avg</p>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0 bg-gray-100 text-gray-600">{agent.resolved}</Badge>
                    </div>
                  ))}
                  {!analytics?.agentPerformance?.length && (
                    <p className="text-sm text-gray-400 text-center py-4">No agent data yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Recent Chatbot Leads */}
              <Card className="bg-white border border-gray-100 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-indigo-500" />
                    Recent Bot Leads
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {recentLeads?.length ? recentLeads.map((lead) => (
                    <div key={lead._id} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                        {lead.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-800">{lead.name}</p>
                        {lead.phone && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" />{lead.phone}
                          </p>
                        )}
                      </div>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0", STAGE_COLORS[lead.stage] || "bg-gray-100 text-gray-600")}>
                        {lead.stage}
                      </span>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-400 text-center py-4">No chatbot leads yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Usage */}
      {usageData && (
        <Card className="bg-white border border-gray-100 shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-500" />
                Usage — <span className="text-indigo-600">{usageData.plan?.name}</span> Plan
                <span className="text-gray-400 font-normal text-xs">({usageData.period})</span>
              </CardTitle>
              {isStarterPlan && (
                <Link href="/dashboard/billing">
                  <Button size="sm" variant="outline" className="text-xs h-7 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                    Upgrade <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {usageData.metrics?.map((metric: {
                resource: string; label: string; used: number; limit: number;
                remaining: number; percentage: number; isUnlimited: boolean;
                isWarning: boolean; isDanger: boolean; isExceeded: boolean;
              }) => (
                <div key={metric.resource} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{metric.label}</span>
                    {metric.isExceeded  && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                    {metric.isDanger && !metric.isExceeded && <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />}
                  </div>
                  {metric.isUnlimited ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">{metric.used}</span>
                      <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-0">∞ Unlimited</Badge>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold text-gray-900">{metric.used}</span>
                        <span className="text-sm text-gray-400">/ {metric.limit}</span>
                      </div>
                      <Progress value={metric.percentage} className={cn("h-1.5", getProgressBg(metric.percentage))} />
                      <p className="text-[11px] text-gray-400">{metric.percentage}% · {metric.remaining} remaining</p>
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

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function getProgressBg(pct: number): string {
  if (pct >= 100) return "[&>div]:bg-red-500";
  if (pct >= 90)  return "[&>div]:bg-orange-500";
  if (pct >= 75)  return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-green-500";
}
