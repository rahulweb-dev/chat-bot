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
  Users, Timer,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCardsSkeleton, ChartSkeleton, ListRowsSkeleton } from "@/components/ui/page-skeletons";

interface OverviewProps { role: string }

// Setup-checklist progress ring — a real percentage (setupSteps completed /
// total), drawn as the circular motif from the Skillset-inspired shell.
function ProgressRing({ percent, size = 46, stroke = 5 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ECEBE6" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#15140F" strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c - (percent / 100) * c} strokeLinecap="round"
      />
    </svg>
  );
}

// A lead's customFields carries whatever a custom chatbot flow collected
// (saveAs per step) plus the already-promoted name/phone/email/score/type
// keys — pull out the first genuinely extra answer so "what they enquired
// about" shows up here too, same as the dedicated Leads page.
const REDUNDANT_FIELD_KEYS = new Set(["name", "phone", "email", "score", "type"]);
function firstEnquiry(customFields?: Record<string, unknown>): string | null {
  if (!customFields) return null;
  for (const [key, value] of Object.entries(customFields)) {
    if (!REDUNDANT_FIELD_KEYS.has(key) && value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return null;
}

export function DashboardOverview({ role }: OverviewProps) {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics", "30d"],
    queryFn: () => fetch("/api/analytics?range=30d").then(r => r.json()).then(d => d.data),
    enabled: role !== "AGENT",
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ["usage"],
    queryFn: () => fetch("/api/usage").then(r => r.json()).then(d => d.data),
  });

  const { data: apiKeys } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => fetch("/api/api-keys").then(r => r.json()).then(d => d.data),
    enabled: role !== "AGENT",
  });

  const { data: recentLeads, isLoading: recentLeadsLoading } = useQuery({
    queryKey: ["dashboard-leads"],
    queryFn: () => fetch("/api/leads?limit=5").then(r => r.json()).then(d => d.data || []),
    enabled: role !== "AGENT",
  });

  const { data: chatbotCfg } = useQuery({
    queryKey: ["chatbot-config"],
    queryFn: () => fetch("/api/chatbot-config").then(r => r.json()).then(d => d.data),
    enabled: role !== "AGENT",
  });

  const { data: liveStats, isLoading: liveStatsLoading } = useQuery({
    queryKey: ["live-stats"],
    queryFn: () => fetch("/api/chat/stats").then(r => r.json()).then(d => d.data),
    refetchInterval: 30_000,
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
  const hasCustomFlow    = !!(chatbotCfg?.customFlow?.enabled && chatbotCfg?.customFlow?.flows?.length);
  const hasLeads         = (overview?.totalLeads ?? 0) > 0;

  const setupSteps = [
    { label: "Create your account",             done: true,             link: null },
    { label: "Get your API key & embed widget", done: hasWidget,        link: "/dashboard/chatbot?tab=install" },
    { label: "Configure your chatbot flow",     done: hasCustomFlow,    link: "/dashboard/chatbot?tab=flow" },
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
          <h1 className="font-display text-2xl font-semibold text-[#15140F]">
            {greet()}, {session?.user?.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-[#9A988D] text-sm mt-1.5">
            {allDone
              ? "Your chatbot is live and generating leads. Here's today's overview."
              : `Complete setup to get your chatbot running — ${setupDone} of ${setupSteps.length} steps done.`}
          </p>
        </div>
        {role !== "AGENT" && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9 border-[#ECEBE6] rounded-full" asChild>
              <Link href="/dashboard/conversations">
                <Inbox className="w-3.5 h-3.5 mr-1.5" /> Inbox
              </Link>
            </Button>
            <Button size="sm" className="h-9 bg-[#15140F] hover:bg-[#2A281F] rounded-full" asChild>
              <Link href="/dashboard/chatbot?tab=install">
                <Code2 className="w-3.5 h-3.5 mr-1.5" /> Install Widget
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* ── Live Stats — dark hero card + 3 compact cards ──────────────── */}
      {liveStatsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px] rounded-[22px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/dashboard/conversations" className="block rounded-[22px] bg-[#15140F] p-5 h-[108px]">
            <p className="text-[13px] text-white/60">Active Chats</p>
            <p className="font-display text-[28px] font-bold text-white mt-2 tabular-nums leading-none">{liveStats?.totalActive ?? "—"}</p>
            <p className="text-[11px] text-white/45 mt-1.5">Live right now</p>
          </Link>
          <div className="rounded-[22px] bg-white p-5 h-[108px]">
            <p className="text-[13px] text-[#9A988D]">Resolved Today</p>
            <p className="font-display text-[28px] font-bold text-[#15140F] mt-2 tabular-nums leading-none">{liveStats?.resolvedToday ?? "—"}</p>
            <p className="text-[11px] text-[#B3B1A6] mt-1.5">Closed out today</p>
          </div>
          <div className="rounded-[22px] bg-white p-5 h-[108px] flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-[#F3F2EE] flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 text-[#15140F]" />
              </div>
              <span className="text-[11px] font-semibold text-[#9A988D]">Online Agents</span>
            </div>
            <p className="font-display text-xl font-bold text-[#15140F] tabular-nums">{liveStats?.onlineAgents ?? "—"}</p>
          </div>
          <div className="rounded-[22px] bg-white p-5 h-[108px] flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-[#F3F2EE] flex items-center justify-center shrink-0">
                <Timer className="w-3.5 h-3.5 text-[#15140F]" />
              </div>
              <span className="text-[11px] font-semibold text-[#9A988D]">Avg Wait</span>
            </div>
            <p className="font-display text-xl font-bold text-[#15140F] tabular-nums">{liveStats ? `${liveStats.avgWaitMinutes}m` : "—"}</p>
          </div>
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      {analyticsLoading ? (
        <StatCardsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Chats Today",       value: todayChats,   icon: MessageSquare, href: "/dashboard/conversations" },
            { label: "Leads Captured",    value: todayLeads,   icon: Tag,           href: "/dashboard/leads"         },
            { label: "Open Tickets",      value: todayTickets, icon: TicketIcon,    href: "/dashboard/tickets"       },
            { label: "Avg Response Time", value: `${overview?.avgResponseTime ?? 0}m`, icon: Clock, href: null },
          ].map(({ label, value, icon: Icon, href }) => (
            <Card key={label} className="border-0 shadow-none bg-white rounded-[22px] group">
              <CardContent className="p-5">
                <div className="w-10 h-10 rounded-xl bg-[#F3F2EE] flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-[#15140F]" />
                </div>
                <p className="font-display text-2xl font-bold text-[#15140F] tabular-nums">{value}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-[#9A988D]">{label}</p>
                  {href && (
                    <Link href={href} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#9A988D]" />
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Activity Chart */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="border-0 shadow-none bg-white rounded-[22px]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-[#15140F] text-sm">Chat &amp; Lead Activity</p>
                  <p className="text-xs text-[#9A988D] mt-0.5">Last 14 days</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#9A988D]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#15140F] inline-block rounded" />Chats</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#3B7A4A] inline-block rounded" />Leads</span>
                </div>
              </div>
              {analyticsLoading ? (
                <ChartSkeleton height={200} />
              ) : chartData.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gChats" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#15140F" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#15140F" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B7A4A" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3B7A4A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EFE9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9A988D" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9A988D" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 12, boxShadow: "0 8px 24px rgba(21,20,15,0.12)" }} />
                    <Area type="monotone" dataKey="Chats" stroke="#15140F" fill="url(#gChats)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Leads" stroke="#3B7A4A" fill="url(#gLeads)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-50 flex flex-col items-center justify-center text-[#D9D7CC] gap-2">
                  <TrendingUp className="w-8 h-8" />
                  <p className="text-sm">Activity will appear once chats start</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Leads */}
          {role !== "AGENT" && (
            <Card className="border-0 shadow-none bg-white rounded-[22px]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-semibold text-[#15140F] text-sm">Recent Leads</p>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-[#15140F] hover:bg-[#F3F2EE] px-2" asChild>
                    <Link href="/dashboard/leads">View all <ArrowUpRight className="w-3 h-3 ml-1" /></Link>
                  </Button>
                </div>
                {recentLeadsLoading ? (
                  <ListRowsSkeleton rows={5} />
                ) : recentLeads?.length ? (
                  <div className="space-y-2">
                    {recentLeads.slice(0, 5).map((lead: { _id: string; name: string; phone?: string; stage: string; customFields?: Record<string, unknown> }) => {
                      const enquiry = firstEnquiry(lead.customFields);
                      return (
                        <div key={lead._id} className="flex items-center gap-3 bg-[#FAFAF8] rounded-xl p-2.5">
                          <div className="w-9 h-9 rounded-full bg-[#F3F2EE] flex items-center justify-center text-xs font-bold text-[#15140F] shrink-0">
                            {lead.name?.charAt(0)?.toUpperCase() ?? "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#15140F] truncate">{lead.name}</p>
                            {enquiry ? (
                              <p className="text-xs text-[#9A988D] truncate mt-0.5">{enquiry}</p>
                            ) : lead.phone ? (
                              <p className="text-xs text-[#9A988D] flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5" />{lead.phone}
                              </p>
                            ) : null}
                          </div>
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#15140F] text-white shrink-0">
                            {lead.stage}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-[#D9D7CC]">
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
            <Card className="border-0 shadow-none bg-white rounded-[22px]">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <ProgressRing percent={setupPercent} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#15140F]" />
                      <p className="font-semibold text-[#15140F] text-sm">Getting Started</p>
                    </div>
                    <p className="text-xs text-[#9A988D] mt-0.5">{setupDone} of {setupSteps.length} steps · {setupPercent}%</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {setupSteps.map((step) => (
                    <div key={step.label} className="flex items-center gap-2.5">
                      {step.done
                        ? <CheckCircle2 className="w-4 h-4 text-[#3B7A4A] shrink-0" />
                        : <Circle className="w-4 h-4 text-[#D9D7CC] shrink-0" />}
                      {step.done || !step.link ? (
                        <span className={`text-sm ${step.done ? "text-[#B3B1A6] line-through" : "text-[#454337] font-medium"}`}>
                          {step.label}
                        </span>
                      ) : (
                        <Link href={step.link} className="text-sm text-[#15140F] font-semibold hover:underline">
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
            <Card className="border-0 shadow-none bg-white rounded-[22px]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#15140F]" />
                    <p className="font-semibold text-[#15140F] text-sm">Embed Widget</p>
                  </div>
                  <button
                    onClick={copyEmbed}
                    className="flex items-center gap-1 text-xs font-medium text-[#15140F] hover:opacity-70 transition-opacity"
                  >
                    {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
                <pre className="bg-[#15140F] text-[#9FE6B4] text-[10px] leading-relaxed p-3 rounded-xl overflow-x-auto font-mono whitespace-pre-wrap break-all">
                  {embedSnippet}
                </pre>
                <p className="text-[11px] text-[#9A988D] mt-2">
                  Paste this before <code className="bg-[#F3F2EE] px-1 rounded">&lt;/body&gt;</code> on your website.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Usage */}
          {role !== "AGENT" && usageLoading && (
            <Card className="border-0 shadow-none bg-white rounded-[22px]">
              <CardContent className="p-5">
                <Skeleton className="h-3.5 w-24 mb-4" />
                <ListRowsSkeleton rows={4} withAvatar={false} />
              </CardContent>
            </Card>
          )}
          {usageData && role !== "AGENT" && (
            <Card className="border-0 shadow-none bg-white rounded-[22px]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-semibold text-[#15140F] text-sm">Plan Usage</p>
                  <span className="text-xs font-semibold text-white bg-[#15140F] px-2.5 py-0.5 rounded-full">
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
                        <span className="text-[#454337]">{m.label}</span>
                        <span className="font-medium text-[#15140F]">
                          {m.isUnlimited ? `${m.used} / ∞` : `${m.used} / ${m.limit}`}
                        </span>
                      </div>
                      {!m.isUnlimited && (
                        <Progress
                          value={m.percentage}
                          className={`h-1.5 bg-[#F3F2EE] ${m.percentage >= 90 ? "[&>div]:bg-[#C24A3D]" : m.percentage >= 70 ? "[&>div]:bg-[#C99A3B]" : "[&>div]:bg-[#15140F]"}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <Link href="/dashboard/billing">
                  <Button size="sm" variant="outline" className="w-full mt-4 h-8 text-xs border-[#ECEBE6] bg-white hover:bg-[#F3F2EE] rounded-full">
                    Upgrade Plan <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Quick Links */}
          <Card className="border-0 shadow-none bg-white rounded-[22px]">
            <CardContent className="p-5">
              <p className="font-semibold text-[#15140F] text-sm mb-3">Quick Links</p>
              <div className="space-y-1">
                {[
                  { label: "Live Inbox",        href: "/dashboard/conversations", icon: Inbox        },
                  { label: "Manage Chatbot",    href: "/dashboard/chatbot",       icon: Bot          },
                  { label: "Add Agents",        href: "/dashboard/agents",        icon: UserPlus,    roles: ["COMPANY_ADMIN", "MANAGER"] },
                  { label: "View Analytics",    href: "/dashboard/analytics",     icon: TrendingUp,  roles: ["COMPANY_ADMIN", "MANAGER"] },
                  { label: "Leaderboard",       href: "/dashboard/leaderboard",   icon: Users,       roles: ["COMPANY_ADMIN", "MANAGER"] },
                ].filter(l => !l.roles || l.roles.includes(role)).map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[#454337] hover:bg-[#F3F2EE] hover:text-[#15140F] transition-colors group"
                  >
                    <Icon className="w-4 h-4 text-[#9A988D] group-hover:text-[#15140F] transition-colors" />
                    {label}
                    <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[#9A988D]" />
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
