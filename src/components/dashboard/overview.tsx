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

interface OverviewProps { role: string }

// Progress ring for the setup checklist — a real percentage (setupSteps
// completed / total), just rendered as the circular motif from the floating-
// card design instead of a linear bar, to match the rest of the shell.
function ProgressRing({ percent, size = 46, stroke = 5 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEEDF5" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#5843D9" strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c - (percent / 100) * c} strokeLinecap="round"
      />
    </svg>
  );
}

// Hero stat card with a decorative wave behind the number — the gradient
// "channel snapshot" card treatment from the floating-card design, applied to
// this dashboard's own live numbers instead of borrowing unrelated content.
function HeroStat({
  label, value, sublabel, gradient, waveOpacity = 0.5, href,
}: {
  label: string; value: string | number; sublabel: string; gradient: string; waveOpacity?: number; href?: string | null;
}) {
  const content = (
    <div className="relative overflow-hidden rounded-2xl p-4 h-[104px]" style={{ background: gradient }}>
      <svg width="100%" height="104" viewBox="0 0 200 104" preserveAspectRatio="none" className="absolute inset-0" style={{ opacity: waveOpacity }}>
        <path d="M0 80 Q50 55 100 75 T200 60 V104 H0 Z" fill="rgba(255,255,255,.18)" />
      </svg>
      <div className="relative">
        <span className="text-[10px] font-bold text-white/80 tracking-widest uppercase">{label}</span>
        <p className="text-xl font-bold text-white mt-4 tabular-nums leading-none">{value}</p>
        <p className="text-[11px] text-white/75 mt-1.5">{sublabel}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

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

  const { data: liveStats } = useQuery({
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
          <h1 className="text-2xl font-bold text-[#1E1B3A]">
            {greet()}, {session?.user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-[#9A96B0] text-sm mt-1">
            {allDone
              ? "Your chatbot is live and generating leads. Here's today's overview."
              : `Complete setup to get your chatbot running — ${setupDone} of ${setupSteps.length} steps done.`}
          </p>
        </div>
        {role !== "AGENT" && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9 border-[#EEEDF5]" asChild>
              <Link href="/dashboard/conversations">
                <Inbox className="w-3.5 h-3.5 mr-1.5" /> Inbox
              </Link>
            </Button>
            <Button size="sm" className="h-9 bg-[#5843D9] hover:bg-[#4735BD] shadow-sm shadow-indigo-200" asChild>
              <Link href="/dashboard/chatbot?tab=install">
                <Code2 className="w-3.5 h-3.5 mr-1.5" /> Install Widget
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* ── Live Stats — hero gradient cards + compact chips ──────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroStat
          label="Active Chats" value={liveStats?.totalActive ?? "—"} sublabel="Live right now"
          gradient="linear-gradient(135deg,#1FA8A0,#0E7A76)" href="/dashboard/conversations"
        />
        <HeroStat
          label="Resolved Today" value={liveStats?.resolvedToday ?? "—"} sublabel="Closed out today"
          gradient="linear-gradient(135deg,#5843D9,#3A2C9E)"
        />
        <div className="rounded-2xl bg-[#F7F7FB] p-4 h-[104px] flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-[#5843D9]" />
            </div>
            <span className="text-[10px] font-semibold text-[#9A96B0] uppercase tracking-wide">Online Agents</span>
          </div>
          <p className="text-xl font-bold text-[#1E1B3A] tabular-nums">{liveStats?.onlineAgents ?? "—"}</p>
        </div>
        <div className="rounded-2xl bg-[#F7F7FB] p-4 h-[104px] flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">
              <Timer className="w-3.5 h-3.5 text-[#F2A93B]" />
            </div>
            <span className="text-[10px] font-semibold text-[#9A96B0] uppercase tracking-wide">Avg Wait</span>
          </div>
          <p className="text-xl font-bold text-[#1E1B3A] tabular-nums">{liveStats ? `${liveStats.avgWaitMinutes}m` : "—"}</p>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Chats Today",       value: todayChats,   icon: MessageSquare, color: "text-[#5843D9]", bg: "bg-[#F0EEFC]",  href: "/dashboard/conversations" },
          { label: "Leads Captured",    value: todayLeads,   icon: Tag,           color: "text-[#2FBF9F]", bg: "bg-[#E8F8F5]",  href: "/dashboard/leads"         },
          { label: "Open Tickets",      value: todayTickets, icon: TicketIcon,    color: "text-[#F2A93B]", bg: "bg-[#FCEFE0]",  href: "/dashboard/tickets"       },
          { label: "Avg Response Time", value: `${overview?.avgResponseTime ?? 0}m`, icon: Clock, color: "text-[#E0577C]", bg: "bg-[#FCE9EF]", href: null },
        ].map(({ label, value, icon: Icon, color, bg, href }) => (
          <Card key={label} className="border-0 shadow-none bg-[#F7F7FB] rounded-2xl group">
            <CardContent className="p-5">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-3xl font-bold text-[#1E1B3A] tabular-nums">{value}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-sm text-[#9A96B0]">{label}</p>
                {href && (
                  <Link href={href} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#9A96B0]" />
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
          <Card className="border-0 shadow-none bg-[#F7F7FB] rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-[#1E1B3A] text-sm">Chat &amp; Lead Activity</p>
                  <p className="text-xs text-[#9A96B0] mt-0.5">Last 14 days</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#9A96B0]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#5843D9] inline-block rounded" />Chats</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#2FBF9F] inline-block rounded" />Leads</span>
                </div>
              </div>
              {chartData.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gChats" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5843D9" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#5843D9" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2FBF9F" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2FBF9F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEEDF5" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9A96B0" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9A96B0" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 12, boxShadow: "0 8px 24px rgba(30,20,70,0.12)" }} />
                    <Area type="monotone" dataKey="Chats" stroke="#5843D9" fill="url(#gChats)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Leads" stroke="#2FBF9F" fill="url(#gLeads)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-50 flex flex-col items-center justify-center text-[#D8D6E8] gap-2">
                  <TrendingUp className="w-8 h-8" />
                  <p className="text-sm">Activity will appear once chats start</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Leads */}
          {role !== "AGENT" && (
            <Card className="border-0 shadow-none bg-[#F7F7FB] rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-semibold text-[#1E1B3A] text-sm">Recent Leads</p>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-[#5843D9] hover:text-[#4735BD] hover:bg-white px-2" asChild>
                    <Link href="/dashboard/leads">View all <ArrowUpRight className="w-3 h-3 ml-1" /></Link>
                  </Button>
                </div>
                {recentLeads?.length ? (
                  <div className="space-y-3">
                    {recentLeads.slice(0, 5).map((lead: { _id: string; name: string; phone?: string; stage: string }) => (
                      <div key={lead._id} className="flex items-center gap-3 bg-white rounded-xl p-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#F0EEFC] flex items-center justify-center text-xs font-bold text-[#5843D9] shrink-0">
                          {lead.name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1E1B3A] truncate">{lead.name}</p>
                          {lead.phone && (
                            <p className="text-xs text-[#9A96B0] flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5" />{lead.phone}
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EEEDF5] text-[#4A4665] shrink-0">
                          {lead.stage}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-[#D8D6E8]">
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
            <Card className="border-0 shadow-none bg-[#F7F7FB] rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <ProgressRing percent={setupPercent} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#5843D9]" />
                      <p className="font-semibold text-[#1E1B3A] text-sm">Getting Started</p>
                    </div>
                    <p className="text-xs text-[#9A96B0] mt-0.5">{setupDone} of {setupSteps.length} steps · {setupPercent}%</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {setupSteps.map((step) => (
                    <div key={step.label} className="flex items-center gap-2.5">
                      {step.done
                        ? <CheckCircle2 className="w-4 h-4 text-[#2FBF9F] shrink-0" />
                        : <Circle className="w-4 h-4 text-[#D8D6E8] shrink-0" />}
                      {step.done || !step.link ? (
                        <span className={`text-sm ${step.done ? "text-[#B0AEC4] line-through" : "text-[#4A4665] font-medium"}`}>
                          {step.label}
                        </span>
                      ) : (
                        <Link href={step.link} className="text-sm text-[#5843D9] font-medium hover:underline">
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
            <Card className="border-0 shadow-none bg-[#F7F7FB] rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#5843D9]" />
                    <p className="font-semibold text-[#1E1B3A] text-sm">Embed Widget</p>
                  </div>
                  <button
                    onClick={copyEmbed}
                    className="flex items-center gap-1 text-xs font-medium text-[#5843D9] hover:text-[#4735BD] transition-colors"
                  >
                    {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
                <pre className="bg-[#1E1B3A] text-[#7EE6C8] text-[10px] leading-relaxed p-3 rounded-xl overflow-x-auto font-mono whitespace-pre-wrap break-all">
                  {embedSnippet}
                </pre>
                <p className="text-[11px] text-[#9A96B0] mt-2">
                  Paste this before <code className="bg-white px-1 rounded">&lt;/body&gt;</code> on your website.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Usage */}
          {usageData && role !== "AGENT" && (
            <Card className="border-0 shadow-none bg-[#F7F7FB] rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-semibold text-[#1E1B3A] text-sm">Plan Usage</p>
                  <span className="text-xs font-semibold text-[#5843D9] bg-[#F0EEFC] px-2 py-0.5 rounded-full">
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
                        <span className="text-[#4A4665]">{m.label}</span>
                        <span className="font-medium text-[#1E1B3A]">
                          {m.isUnlimited ? `${m.used} / ∞` : `${m.used} / ${m.limit}`}
                        </span>
                      </div>
                      {!m.isUnlimited && (
                        <Progress
                          value={m.percentage}
                          className={`h-1.5 bg-white ${m.percentage >= 90 ? "[&>div]:bg-[#E0577C]" : m.percentage >= 70 ? "[&>div]:bg-[#F2A93B]" : "[&>div]:bg-[#5843D9]"}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <Link href="/dashboard/billing">
                  <Button size="sm" variant="outline" className="w-full mt-4 h-8 text-xs border-[#EEEDF5] bg-white hover:border-[#5843D9]/30 hover:text-[#5843D9] hover:bg-[#F0EEFC]">
                    Upgrade Plan <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Quick Links */}
          <Card className="border-0 shadow-none bg-[#F7F7FB] rounded-2xl">
            <CardContent className="p-5">
              <p className="font-semibold text-[#1E1B3A] text-sm mb-3">Quick Links</p>
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
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[#4A4665] hover:bg-white hover:text-[#1E1B3A] transition-colors group"
                  >
                    <Icon className="w-4 h-4 text-[#9A96B0] group-hover:text-[#5843D9] transition-colors" />
                    {label}
                    <ArrowUpRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[#9A96B0]" />
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
