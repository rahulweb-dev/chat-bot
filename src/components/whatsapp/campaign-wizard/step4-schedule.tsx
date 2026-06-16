"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Calendar, Rocket } from "lucide-react";

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
      toast({ title: msg, variant: "destructive" });
    },
  });

  if (!campaignId) {
    return <p className="text-sm text-muted-foreground">Save the campaign details first to schedule or launch.</p>;
  }

  return (
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

        {mode === "now" ? (
          <Button disabled={launch.isPending} onClick={() => launch.mutate()}>
            {launch.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
            Launch Campaign
          </Button>
        ) : (
          <Button disabled={!scheduledAt || schedule.isPending} onClick={() => schedule.mutate()}>
            {schedule.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
            Schedule Campaign
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
