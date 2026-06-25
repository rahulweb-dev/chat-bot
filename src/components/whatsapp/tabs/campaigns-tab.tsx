"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Plus, Ban, Megaphone } from "lucide-react";
import { EmptyState, PageLoading } from "@/components/whatsapp/empty-state";
import { WalletHeader } from "@/components/whatsapp/wallet-header";
import { CampaignWizard } from "@/components/whatsapp/campaign-wizard";
import { timeAgo } from "@/lib/utils";

interface Campaign {
  _id: string;
  name: string;
  templateName?: string;
  status: "DRAFT" | "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
  scheduledAt?: string;
  failureReason?: string;
  stats: { total: number; sent: number; delivered: number; read: number; failed: number };
  createdAt: string;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SCHEDULED: "bg-blue-100 text-blue-700",
  RUNNING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELED: "bg-gray-100 text-gray-500",
};

export function CampaignsTab() {
  const qc = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ["whatsapp-campaigns"],
    queryFn: () => axios.get("/api/whatsapp/campaigns", { params: { limit: 50 } }).then((r) => r.data.data),
    refetchInterval: 10000,
    enabled: !showWizard,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => axios.patch(`/api/whatsapp/campaigns/${id}`, { action: "cancel" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-campaigns"] });
      toast({ title: "Campaign canceled" });
    },
  });

  if (showWizard) {
    return (
      <CampaignWizard
        onExit={() => {
          setShowWizard(false);
          qc.invalidateQueries({ queryKey: ["whatsapp-campaigns"] });
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <WalletHeader />
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Campaigns</h1>
            <p className="text-muted-foreground">Send approved templates to opted-in contacts</p>
          </div>
          <Button onClick={() => setShowWizard(true)}><Plus className="h-4 w-4 mr-2" />New Campaign</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <PageLoading />
            ) : campaigns?.length === 0 ? (
              <EmptyState icon={Megaphone} title="No campaigns yet" description="Create a campaign to send an approved template to your opted-in contacts." />
            ) : (
              <div className="divide-y">
                {campaigns?.map((c) => (
                  <div key={c._id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{c.name}</p>
                        <Badge className={statusColors[c.status]}>{c.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Template: {c.templateName || "—"} · {timeAgo(c.createdAt)}
                      </p>
                      {c.status === "FAILED" && c.failureReason && (
                        <p className="text-xs text-red-600 mt-0.5">
                          Reason: {c.failureReason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{c.stats.total} total</span>
                      <span className="text-green-600">{c.stats.sent} sent</span>
                      <span className="text-blue-600">{c.stats.delivered} delivered</span>
                      <span className="text-indigo-600">{c.stats.read} read</span>
                      <span className="text-red-600">{c.stats.failed} failed</span>
                      {["DRAFT", "SCHEDULED"].includes(c.status) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => cancel.mutate(c._id)}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
