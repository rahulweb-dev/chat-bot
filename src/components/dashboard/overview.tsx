"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare, Tag, TicketIcon, Clock, Bot,
  ArrowUpRight, Copy, CheckCircle2, Circle,
  Inbox, UserPlus, Code2, Zap, TrendingUp, Phone,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { useSession } from "next-auth/react";
import { useState } from "react";

interface OverviewProps { role: string }

export function DashboardOverview({ role }: OverviewProps) {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);

  const { data: analytics } = useQuery({
    queryKey: ["analytics", "30d"],
    queryFn: () => fetch("/api/analytics?range=30d").then(r => r.json()).then(d => d.data),
    enabled: role !== "AGENT",
  });

  const { data: usageData } = useQuery({
    queryKey: ["usage"],
    queryFn: () => fetch("/api/usage").then(r => r.json()).then(d => d.data),
  });

  const { data: apiKeys } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => fetch("/api/api-keys").then(r => r.json()).then(d => d.data),
    enabled: role !== "AGENT",
  });

  const { data: recentLeads } = useQuery({
    queryKey: ["dashboard-leads"],
    queryFn: () => fetch("/api/leads?limit=5").then(r => r.json()).then(d => d.data || []),
    enabled: role !== "AGENT",
  });

  const { data: chatbotCfg } = useQuery({
    queryKey: ["chatbot-config"],
    queryFn: () => fetch("/api/chatbot-config").then(r => r.json()).then(d => d.data),
    enabled: role !== "AGENT",
  });

  const overview  = analytics?.overview;
  const trends    = analytics?.trends;
  const widgetKey = apiKeys?.[0]?.key;
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com";

  // Today's values
  const todayChats   = trends?.chats?.at(-1)?.value   ?? 0;
  const todayLeads   = trends?.leads?.at(-1)?.value   ?? 0;
  const todayTickets = trends?.tickets?.at(-1)?.value ?? 0;

  // Chart data (last 14 days for simplicity)
  const chartData = (trends?.chats ?? []).slice(-14).map((d: { date: string; value: number }, i: number) => ({
    date: d.date.slice(5),
    Chats:  d.value,
    Leads:  trends?.leads?.[trends.chats.length - 14 + i]?.value ?? 0,
  }));

  // Setup checklist
  const hasConversations = (overview?.totalChats ?? 0) > 0;
  const hasWidget        = !!widgetKey;
  const hasCustomFlow    = !!(chatbotCfg?.customFlow?.enabled && chatbotCfg?.customFlow?.flow);
  const hasLeads         = (overview?.totalLeads ?? 0) > 0;

  const setupSteps = [
    { label: "Create your account",             done: true,             link: null },
    { label: "Get your API key & embed widget", done: hasWidget,        link: "/dashboard/widget" },
    { label: "Configure your chatbot flow",     done: hasCustomFlow,    link: "/dashboard/chatbot-settings" },
    { label: "Start your first conversation",   done: hasConversations, link: "/dashboard/conversations" },
    { label: "Capture your first lead",         done: hasLeads,         link: "/dashboard/leads" },
  ];
  const setupDone    = setupSteps.filter(s => s.done).length;
  const setupPercent = Math.round((setupDone / setupSteps.length) * 100);
  const allDone      = setupDone === setupSteps.length;

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const embedSnippet = widgetKey
    ? `<script>
  window.SupportFlowConfig = {
    apiKey: "${widgetKey}",
    baseUrl: "${appUrl}",
  };
</script>
<script src="${appUrl}/widget.js" defer></script>`
    : null;

  const copyEmbed = () => {
    if (!embedSnippet) return;
    navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pb-8">

      {/* ── Welcome ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greet()}, {session?.user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {allDone
              ? "Your chatbot is live and generating leads. Here's today's overview."
              : `Complete setup to get your chatbot running — ${setupDone} of ${setupSteps.length} steps done.`}
          </p>
        </div>
        {role !== "AGENT" && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9 border-gray-200" asChild>
              <Link href="/dashboard/conversations">
                <Inbox className="w-3.5 h-3.5 mr-1.5" /> Inbox
              </Link>
            </Button>
            <Button size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200" asChild>
              <Link href="/dashboard/widget">
                <Code2 className="w-3.5 h-3.5 mr-1.5" /> Install Widget
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Chats Today",       value: todayChats,   icon: MessageSquare, color: "text-indigo-600", bg: "bg-indigo-50",  href: "/dashboard/conversations" },
          { label: "Leads Captured",    value: todayLeads,   icon: Tag,           color: "text-green-600",  bg: "bg-green-50",   href: "/dashboard/leads"         },
          { label: "Open Tickets",      value: todayTickets, icon: TicketIcon,    color: "text-orange-600", bg: "bg-orange-50",  href: "/dashboard/tickets"       },
          { label: "Avg Response Time", value: `${overview?.avgResponseTime ?? 0}m`, icon: Clock, color: "text-purple-600", bg: "bg-purple-50", href: null },
        ].map(({ label, value, icon: Icon, color, bg, href }) => (
          <Card key={label} className="border border-gray-100 shadow-none hover:shadow-sm transition-shadow group">
            <CardContent className="p-5">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-sm text-gray-500">{label}</p>
                {href && (
                  <Link href={href} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-400" />
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Activity Chart */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="border border-gray-100 shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Chat & Lead Activity</p>
                  <p className="text-xs text-gray-400 mt-0.5">Last 14 days</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-indigo-500 inline-block rounded" />Chats</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-green-500 inline-block rounded" />Leads</span>
                </div>
              </div>
              {chartData.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gChats" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
                    <Area type="monotone" dataKey="Chats" stroke="#6366f1" fill="url(#gChats)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Leads" stroke="#22c55e" fill="url(#gLeads)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-50 flex flex-col items-center justify-center text-gray-300 gap-2">
                  <TrendingUp className="w-8 h-8" />
                  <p className="text-sm">Activity will appear once chats start</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Leads */}
          {role !== "AGENT" && (
            <Card className="border border-gray-100 shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-semibold text-gray-900 text-sm">Recent Leads</p>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2" asChild>
                    <Link href="/dashboard/leads">View all <ArrowUpRight className="w-3 h-3 ml-1" /></Link>
                  </Button>
                </div>
                {recentLeads?.length ? (
                  <div className="space-y-3">
                    {recentLeads.slice(0, 5).map((lead: { _id: string; name: string; phone?: string; stage: string }) => (
                      <div key={lead._id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                          {lead.name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{lead.name}</p>
                          {lead.phone && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5" />{lead.phone}
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">
                          {lead.stage}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-300">
                    <UserPlus className="w-7 h-7 mx-auto mb-2" />
                    <p className="text-sm">Leads captured by the chatbot appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-5">

          {/* Setup Guide */}
          {role !== "AGENT" && !allDone && (
            <Card className="border border-indigo-100 bg-indigo-50/30 shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <p className="font-semibold text-gray-900 text-sm">Getting Started</p>
                  <span className="ml-auto text-xs font-bold text-indigo-600">{setupDone}/{setupSteps.length}</span>
                </div>
                <Progress value={setupPercent} className="h-1.5 mb-4 [&>div]:bg-indigo-500" />
                <div className="space-y-2.5">
                  {setupSteps.map((step) => (
                    <div key={step.label} className="flex items-center gap-2.5">
                      {step.done
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        : <Circle className="w-4 h-4 text-gray-300 shrink-0" />}
                      {step.done || !step.link ? (
                        <span className={`text-sm ${step.done ? "text-gray-400 line-through" : "text-gray-700 font-medium"}`}>
                          {step.label}
                        </span>
                      ) : (
                        <Link href={step.link} className="text-sm text-indigo-600 font-medium hover:underline">
                          {step.label} →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Widget Embed Code */}
          {role !== "AGENT" && embedSnippet && (
            <Card className="border border-gray-100 shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-indigo-500" />
                    <p className="font-semibold text-gray-900 text-sm">Embed Widget</p>
                  </div>
                  <button
                    onClick={copyEmbed}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 text-[10px] leading-relaxed p-3 rounded-xl overflow-x-auto font-mono whitespace-pre-wrap break-all">
                  {embedSnippet}
                </pre>
                <p className="text-[11px] text-gray-400 mt-2">
                  Paste this before <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> on your website.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Usage */}
          {usageData && role !== "AGENT" && (
            <Card className="border border-gray-100 shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-semibold text-gray-900 text-sm">Plan Usage</p>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {usageData.plan?.name ?? "Free"}
                  </span>
                </div>
                <div className="space-y-3">
                  {usageData.metrics?.slice(0, 4).map((m: {
                    resource: string; label: string; used: number;
                    limit: number; percentage: number; isUnlimited: boolean;
                  }) => (
                    <div key={m.resource}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600">{m.label}</span>
                        <span className="font-medium text-gray-700">
                          {m.isUnlimited ? `${m.used} / ∞` : `${m.used} / ${m.limit}`}
                        </span>
                      </div>
                      {!m.isUnlimited && (
                        <Progress
                          value={m.percentage}
                          className={`h-1.5 ${m.percentage >= 90 ? "[&>div]:bg-red-500" : m.percentage >= 70 ? "[&>div]:bg-orange-400" : "[&>div]:bg-indigo-500"}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <Link href="/dashboard/billing">
                  <Button size="sm" variant="outline" className="w-full mt-4 h-8 text-xs border-gray-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50">
                    Upgrade Plan <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Quick Links */}
          <Card className="border border-gray-100 shadow-none">
            <CardContent className="p-5">
              <p className="font-semibold text-gray-900 text-sm mb-3">Quick Links</p>
              <div className="space-y-1">
                {[
                  { label: "Live Inbox",        href: "/dashboard/conversations", icon: Inbox        },
                  { label: "Manage Chatbot",    href: "/dashboard/chatbots",      icon: Bot          },
                  { label: "Add Agents",        href: "/dashboard/agents",        icon: UserPlus,    roles: ["COMPANY_ADMIN", "MANAGER"] },
                  { label: "Widget Builder",    href: "/dashboard/widget",        icon: Code2,       roles: ["COMPANY_ADMIN"] },
                  { label: "View Analytics",    href: "/dashboard/analytics",     icon: TrendingUp,  roles: ["COMPANY_ADMIN", "MANAGER"] },
                ].filter(l => !l.roles || l.roles.includes(role)).map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors group"
                  >
                    <Icon className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                    {label}
                    <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
