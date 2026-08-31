"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Megaphone, Users, Send, CheckCheck, XCircle, Eye, MousePointerClick, Clock } from "lucide-react";
import { ChannelBadge } from "./shared";

interface ChannelStats {
  campaigns: number;
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  readOrOpened: number;
  clicked: number;
  pending: number;
  bounced?: number;
  conversationsWithReplies?: number;
  unsubscribed?: number;
}

interface Stats {
  totalCampaigns: number;
  whatsappCampaigns: number;
  rcsCampaigns: number;
  emailCampaigns: number;
  totalRecipients: number;
  totalSent: number;
  delivered: number;
  failed: number;
  pending: number;
  readOrOpened: number;
  clicked: number;
  unsubscribed: number;
  byChannel: { whatsapp: ChannelStats; rcs: ChannelStats; email: ChannelStats };
}

export function OverviewTab({ stats, onNavigate }: { companyId: string; stats?: Stats; onNavigate: (tab: "campaigns" | "recipients" | "analytics" | "replies") => void }) {
  if (!stats) return null;

  const cards = [
    { label: "Total Campaigns", value: stats.totalCampaigns, icon: Megaphone, color: "text-indigo-500", onClick: () => onNavigate("campaigns") },
    { label: "Total Recipients", value: stats.totalRecipients, icon: Users, color: "text-blue-500", onClick: () => onNavigate("recipients") },
    { label: "Sent", value: stats.totalSent, icon: Send, color: "text-sky-500" },
    { label: "Delivered", value: stats.delivered, icon: CheckCheck, color: "text-teal-500" },
    { label: "Failed", value: stats.failed, icon: XCircle, color: "text-red-500" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-500" },
    { label: "Read / Opened", value: stats.readOrOpened, icon: Eye, color: "text-violet-500" },
    { label: "Clicked", value: stats.clicked, icon: MousePointerClick, color: "text-fuchsia-500" },
  ];

  const channelChartData = [
    { channel: "WhatsApp", Sent: stats.byChannel.whatsapp.sent, Delivered: stats.byChannel.whatsapp.delivered, Failed: stats.byChannel.whatsapp.failed },
    { channel: "RCS", Sent: stats.byChannel.rcs.sent, Delivered: stats.byChannel.rcs.delivered, Failed: stats.byChannel.rcs.failed },
    { channel: "Email", Sent: stats.byChannel.email.sent, Delivered: stats.byChannel.email.delivered, Failed: stats.byChannel.email.failed },
  ];

  const channelRows: { key: "WHATSAPP" | "RCS" | "EMAIL"; s: ChannelStats }[] = [
    { key: "WHATSAPP", s: stats.byChannel.whatsapp },
    { key: "RCS", s: stats.byChannel.rcs },
    { key: "EMAIL", s: stats.byChannel.email },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, onClick }) => (
          <Card key={label} className={onClick ? "cursor-pointer hover:border-indigo-300 transition-colors" : undefined} onClick={onClick}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Channel Comparison</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={channelChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Sent" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Delivered" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">By Channel</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Channel</th>
                  <th className="px-4 py-2 font-medium text-right">Campaigns</th>
                  <th className="px-4 py-2 font-medium text-right">Recipients</th>
                  <th className="px-4 py-2 font-medium text-right">Delivered</th>
                  <th className="px-4 py-2 font-medium text-right">Failed</th>
                  <th className="px-4 py-2 font-medium text-right">Pending</th>
                  <th className="px-4 py-2 font-medium text-right">Read/Open</th>
                </tr>
              </thead>
              <tbody>
                {channelRows.map(({ key, s }) => (
                  <tr key={key} className="border-b last:border-0">
                    <td className="px-4 py-2.5"><ChannelBadge channel={key} /></td>
                    <td className="px-4 py-2.5 text-right">{s.campaigns}</td>
                    <td className="px-4 py-2.5 text-right">{s.total}</td>
                    <td className="px-4 py-2.5 text-right text-teal-600">{s.delivered}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{s.failed}</td>
                    <td className="px-4 py-2.5 text-right text-amber-600">{s.pending}</td>
                    <td className="px-4 py-2.5 text-right text-violet-600">{s.readOrOpened}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
