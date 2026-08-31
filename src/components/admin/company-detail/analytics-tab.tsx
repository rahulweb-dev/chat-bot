"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Loader2, MessageCircle } from "lucide-react";

interface ChannelStats {
  campaigns: number;
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  readOrOpened: number;
  clicked: number;
  pending: number;
  conversationsWithReplies?: number;
}

interface Stats {
  byChannel: { whatsapp: ChannelStats; rcs: ChannelStats; email: ChannelStats };
}

interface NormalizedCampaign {
  channel: "WHATSAPP" | "RCS" | "EMAIL";
  sent: number;
  delivered: number;
  failed: number;
  createdAt: string;
}

function pct(num: number, denom: number) {
  if (!denom) return 0;
  return Math.round((num / denom) * 1000) / 10;
}

export function AnalyticsTab({ companyId, stats }: { companyId: string; stats?: Stats }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-company-campaigns-trend", companyId],
    queryFn: () =>
      axios
        .get(`/api/admin/companies/${companyId}/campaigns`, { params: { limit: 100 } })
        .then((r) => r.data.data.items as NormalizedCampaign[]),
  });

  const trend = useMemo(() => {
    if (!data) return [];
    const byDay = new Map<string, { date: string; Sent: number; Delivered: number; Failed: number }>();
    for (const c of data) {
      const day = new Date(c.createdAt).toISOString().slice(0, 10);
      const entry = byDay.get(day) || { date: day, Sent: 0, Delivered: 0, Failed: 0 };
      entry.Sent += c.sent;
      entry.Delivered += c.delivered;
      entry.Failed += c.failed;
      byDay.set(day, entry);
    }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  if (!stats) return null;

  const rateData = [
    { channel: "WhatsApp", "Delivery %": pct(stats.byChannel.whatsapp.delivered, stats.byChannel.whatsapp.total), "Read %": pct(stats.byChannel.whatsapp.readOrOpened, stats.byChannel.whatsapp.delivered) },
    { channel: "RCS", "Delivery %": pct(stats.byChannel.rcs.delivered, stats.byChannel.rcs.total), "Read %": pct(stats.byChannel.rcs.readOrOpened, stats.byChannel.rcs.delivered) },
    { channel: "Email", "Delivery %": pct(stats.byChannel.email.delivered, stats.byChannel.email.total), "Read %": pct(stats.byChannel.email.readOrOpened, stats.byChannel.email.delivered), "Click %": pct(stats.byChannel.email.clicked, stats.byChannel.email.delivered) },
  ];

  const waReplyRate = pct(stats.byChannel.whatsapp.conversationsWithReplies || 0, stats.byChannel.whatsapp.delivered);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Campaign Performance Over Time</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-52"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : trend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">No campaign data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Sent" stroke="#6366f1" fill="url(#sentGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="Delivered" stroke="#14b8a6" fill="transparent" strokeWidth={2} />
                <Area type="monotone" dataKey="Failed" stroke="#ef4444" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Delivery &amp; Read Rate by Channel</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={rateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, ""]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Delivery %" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Read %" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">WhatsApp Reply Rate</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[240px] gap-2">
            <MessageCircle className="h-8 w-8 text-green-500" />
            <p className="text-3xl font-bold">{waReplyRate}%</p>
            <p className="text-sm text-muted-foreground text-center">
              {stats.byChannel.whatsapp.conversationsWithReplies || 0} of {stats.byChannel.whatsapp.delivered} delivered contacts replied
            </p>
            <p className="text-xs text-muted-foreground text-center mt-1">
              RCS and Email reply tracking is not available — those channels don&apos;t capture inbound replies in this app.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
