"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Users, CheckCheck, Eye, Megaphone } from "lucide-react";
import { EmptyState, PageLoading } from "@/components/whatsapp/empty-state";

interface Analytics {
  messagesToday: number;
  activeConversations: number;
  deliveryRate: number;
  readRate: number;
  campaigns: { _id: string; name: string; status: string; stats: { total: number; sent: number; delivered: number; read: number; failed: number } }[];
}

export function AnalyticsTab() {
  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["whatsapp-analytics"],
    queryFn: () => axios.get("/api/whatsapp/analytics").then((r) => r.data.data),
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <PageLoading />
      </div>
    );
  }

  const cards = [
    { label: "Messages Today", value: data.messagesToday, icon: MessageSquare, color: "text-indigo-600 bg-indigo-100" },
    { label: "Active Conversations", value: data.activeConversations, icon: Users, color: "text-blue-600 bg-blue-100" },
    { label: "Delivery Rate", value: `${data.deliveryRate}%`, icon: CheckCheck, color: "text-green-600 bg-green-100" },
    { label: "Read Rate", value: `${data.readRate}%`, icon: Eye, color: "text-purple-600 bg-purple-100" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Analytics</h1>
        <p className="text-muted-foreground">Performance overview for the WhatsApp channel</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-bold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Campaign Performance</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.campaigns.length === 0 ? (
            <EmptyState icon={Megaphone} title="No campaigns yet" description="Campaign performance will appear here once you send your first one." />
          ) : (
            <div className="divide-y">
              {data.campaigns.map((c) => (
                <div key={c._id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{c.name}</p>
                    <Badge variant="outline">{c.status}</Badge>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{c.stats.total} total</span>
                    <span className="text-green-600">{c.stats.sent} sent</span>
                    <span className="text-blue-600">{c.stats.delivered} delivered</span>
                    <span className="text-indigo-600">{c.stats.read} read</span>
                    <span className="text-red-600">{c.stats.failed} failed</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
