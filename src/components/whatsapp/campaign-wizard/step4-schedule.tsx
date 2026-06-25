"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Calendar, Rocket, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface CampaignSummary {
  campaign: {
    name: string;
    templateName?: string;
    audienceTags: string[];
    audienceContactIds: string[];
    status: string;
  };
  recipients: { _id: string }[];
}

export function Step4Schedule({
  campaignId,
  onLaunched,
  initialMode = "now",
}: {
  campaignId: string | null;
  onLaunched: () => void;
  initialMode?: "now" | "later";
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [mode, setMode] = useState<"now" | "later">(initialMode);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const { data: summary } = useQuery<CampaignSummary>({
    queryKey: ["whatsapp-campaign-summary", campaignId],
    queryFn: () => axios.get(`/api/whatsapp/campaigns/${campaignId}`).then((r) => r.data.data),
    enabled: !!campaignId,
  });

  const hasTemplate = !!summary?.campaign.templateName;
  const hasAudience =
    (summary?.campaign.audienceTags?.length ?? 0) > 0 ||
    (summary?.campaign.audienceContactIds?.length ?? 0) > 0 ||
    (summary?.recipients?.length ?? 0) > 0;
  const canLaunch = hasTemplate && hasAudience;

  const schedule = useMutation({
    mutationFn: () => axios.patch(`/api/whatsapp/campaigns/${campaignId}`, { action: "schedule", scheduledAt }),
    onSuccess: () => { toast({ title: "Campaign scheduled" }); onLaunched(); },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to schedule";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const launch = useMutation({
    mutationFn: () => axios.patch(`/api/whatsapp/campaigns/${campaignId}`, { action: "launch" }),
    onSuccess: () => { toast({ title: "Campaign launched" }); onLaunched(); },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to launch";
      setLaunchError(msg);
      toast({ title: msg, variant: "destructive" });
    },
  });

  if (!campaignId) {
    return <p className="text-sm text-muted-foreground">Save the campaign details first to schedule or launch.</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Pre-launch Checklist</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {hasTemplate ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            )}
            <span className={hasTemplate ? "text-gray-700" : "text-red-600 font-medium"}>
              {hasTemplate
                ? `Template selected: ${summary?.campaign.templateName}`
                : "No template selected — go back to Step 1 and pick an approved template"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {hasAudience ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            )}
            <span className={hasAudience ? "text-gray-700" : "text-red-600 font-medium"}>
              {hasAudience
                ? `Audience ready: ${summary?.recipients?.length ?? 0} recipient(s) or audience tags set`
                : "No recipients added — go back to Step 2 and upload your contact list"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Schedule or Launch</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button type="button" variant={mode === "now" ? "default" : "outline"} size="sm" onClick={() => setMode("now")}>
              <Rocket className="h-3.5 w-3.5 mr-1.5" />Send Now
            </Button>
            <Button type="button" variant={mode === "later" ? "default" : "outline"} size="sm" onClick={() => setMode("later")}>
              <Calendar className="h-3.5 w-3.5 mr-1.5" />Schedule for Later
            </Button>
          </div>

          {mode === "later" && (
            <div className="space-y-2 max-w-sm">
              <Label>Scheduled Date & Time</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            This will send your approved template to every recipient added in Step 2 who has opted in.
          </p>

          {launchError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{launchError}</p>
            </div>
          )}

          {!canLaunch && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Fix the checklist issues above before launching.
              </p>
            </div>
          )}

          {mode === "now" ? (
            <Button disabled={!canLaunch || launch.isPending} onClick={() => { setLaunchError(null); launch.mutate(); }}>
              {launch.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
              Launch Campaign
            </Button>
          ) : (
            <Button disabled={!scheduledAt || !canLaunch || schedule.isPending} onClick={() => schedule.mutate()}>
              {schedule.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
              Schedule Campaign
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
