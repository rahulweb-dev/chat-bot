"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { MessageSquare, Ticket, Tag, Star, Clock, TrendingUp, Users, Zap, Bot } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface Lead {
  _id: string;
  stage: string;
  source?: string;
  title?: string;
  createdAt: string;
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AnalyticsPage() {
  const [range, setRange] = useState("30d");

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", range],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?range=${range}`);
      const d = await res.json();
      return d.data;
    },
  });

  const { data: leadsBreakdown } = useQuery({
    queryKey: ["analytics-leads-breakdown"],
    queryFn: async () => {
      const res = await fetch("/api/leads?limit=500");
      const d = await res.json();
      const leads: Lead[] = d.data || [];

      const bySource: Record<string, number> = {};
      const byStage: Record<string, number> = {};
      for (const l of leads) {
        const src = l.source === "CHAT_WIDGET" ? "Chatbot" : l.source === "MANUAL" ? "Manual" : "Other";
        bySource[src] = (bySource[src] || 0) + 1;
        byStage[l.stage] = (byStage[l.stage] || 0) + 1;
      }

      return {
        sourcePie: Object.entries(bySource).map(([name, value]) => ({ name, value })),
        stageBar: Object.entries(byStage).map(([stage, count]) => ({ stage, count })),
        total: leads.length,
        chatbotCount: leads.filter((l) => l.source === "CHAT_WIDGET").length,
      };
    },
  });

  const overview = data?.overview;
  const trends = data?.trends;
  const agentPerf = data?.agentPerformance;

  const chartData = trends?.chats?.map((d: { date: string; value: number }, i: number) => ({
    date: d.date.slice(5),
    Chats: d.value,
    Tickets: trends.tickets[i]?.value || 0,
    Leads: trends.leads[i]?.value || 0,
  })) || [];

  const statCards = [
    { icon: MessageSquare, label: "Total Chats", value: overview?.totalChats, color: "text-blue-600", bg: "bg-blue-50" },
    { icon: Ticket, label: "Total Tickets", value: overview?.totalTickets, color: "text-orange-600", bg: "bg-orange-50" },
    { icon: Tag, label: "Total Leads", value: overview?.totalLeads, color: "text-green-600", bg: "bg-green-50" },
    { icon: Star, label: "CSAT Avg", value: overview?.csat?.avg ? `${overview.csat.avg}/5` : "N/A", color: "text-yellow-600", bg: "bg-yellow-50" },
    { icon: Clock, label: "Avg Response", value: `${overview?.avgResponseTime || 0}m`, color: "text-purple-600", bg: "bg-purple-50" },
    { icon: TrendingUp, label: "Resolution Rate", value: `${overview?.chatResolutionRate || 0}%`, color: "text-indigo-600", bg: "bg-indigo-50" },
    { icon: Tag, label: "Lead Conversion", value: `${overview?.leadConversionRate || 0}%`, color: "text-cyan-600", bg: "bg-cyan-50" },
    { icon: Zap, label: "AI Messages", value: overview?.totalMessages, color: "text-pink-600", bg: "bg-pink-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Track your platform performance</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <p className="text-2xl font-bold">{isLoading ? "—" : formatNumber(typeof card.value === "number" ? card.value : 0) || card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Activity Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  {["#6366f1", "#22c55e", "#f59e0b"].map((color, i) => (
                    <linearGradient key={i} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="Chats" stroke="#6366f1" fill="url(#grad0)" strokeWidth={2} />
                <Area type="monotone" dataKey="Leads" stroke="#22c55e" fill="url(#grad1)" strokeWidth={2} />
                <Area type="monotone" dataKey="Tickets" stroke="#f59e0b" fill="url(#grad2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Agent Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agentPerf?.slice(0, 6).map((agent: { id: string; name: string; chatsHandled: number; resolved: number; avgResponseTime: number }) => (
                <div key={agent.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                    {agent.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{agent.name}</p>
                      <span className="text-xs text-gray-500">{agent.chatsHandled} chats</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, (agent.resolved / (agent.chatsHandled || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {!agentPerf?.length && <p className="text-sm text-gray-400 text-center py-4">No data yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Ticket Resolution Rate</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Resolved", value: overview?.ticketResolutionRate || 0 },
                    { name: "Unresolved", value: 100 - (overview?.ticketResolutionRate || 0) },
                  ]}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={70}
                  dataKey="value"
                >
                  {[0, 1].map((i) => <Cell key={i} fill={i === 0 ? "#22c55e" : "#e5e7eb"} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center -mt-2">
              <p className="text-3xl font-bold text-green-600">{overview?.ticketResolutionRate || 0}%</p>
              <p className="text-xs text-gray-500">resolved</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Chat Resolution Rate</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Resolved", value: overview?.chatResolutionRate || 0 },
                    { name: "Unresolved", value: 100 - (overview?.chatResolutionRate || 0) },
                  ]}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={70}
                  dataKey="value"
                >
                  {[0, 1].map((i) => <Cell key={i} fill={i === 0 ? "#6366f1" : "#e5e7eb"} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center -mt-2">
              <p className="text-3xl font-bold text-indigo-600">{overview?.chatResolutionRate || 0}%</p>
              <p className="text-xs text-gray-500">resolved</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Lead Conversion</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Won", value: overview?.leadConversionRate || 0 },
                    { name: "Other", value: 100 - (overview?.leadConversionRate || 0) },
                  ]}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={70}
                  dataKey="value"
                >
                  {[0, 1].map((i) => <Cell key={i} fill={i === 0 ? "#22c55e" : "#e5e7eb"} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center -mt-2">
              <p className="text-3xl font-bold text-green-600">{overview?.leadConversionRate || 0}%</p>
              <p className="text-xs text-gray-500">conversion</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chatbot & Lead Analytics */}
      {leadsBreakdown && leadsBreakdown.total > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-semibold">Chatbot &amp; Lead Analytics</h2>
            <Badge variant="secondary" className="text-xs">
              {leadsBreakdown.chatbotCount} / {leadsBreakdown.total} from chatbot
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lead Source Breakdown */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie
                        data={leadsBreakdown.sourcePie}
                        cx="50%" cy="50%"
                        innerRadius={40} outerRadius={65}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}
                        labelLine={false}
                      >
                        {leadsBreakdown.sourcePie.map((_, i) => (
                          <Cell key={i} fill={["#6366f1", "#22c55e", "#f59e0b"][i % 3]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {leadsBreakdown.sourcePie.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: ["#6366f1", "#22c55e", "#f59e0b"][i % 3] }}
                          />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <span className="text-sm font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lead Stage Distribution */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Lead Stage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={leadsBreakdown.stageBar} layout="vertical" margin={{ left: 16, right: 8 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={72} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {leadsBreakdown.stageBar.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.stage === "WON" ? "#22c55e" :
                            entry.stage === "LOST" ? "#ef4444" :
                            entry.stage === "PROPOSAL" ? "#f59e0b" :
                            "#6366f1"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
