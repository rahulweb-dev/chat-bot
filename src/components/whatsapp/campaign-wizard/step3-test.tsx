"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Send } from "lucide-react";

export function Step3Test({ campaignId }: { campaignId: string | null }) {
  const [phone, setPhone] = useState("");

  const sendTest = useMutation({
    mutationFn: () => axios.post(`/api/whatsapp/campaigns/${campaignId}/test`, { phone }),
    onSuccess: () => toast({ title: "Test message sent" }),
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Test send failed";
      toast({ title: msg, variant: "destructive" });
    },
  });

  if (!campaignId) {
    return <p className="text-sm text-muted-foreground">Save the campaign details first to send a test message.</p>;
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Send a Test Message</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Send this campaign&apos;s template to your own number before launching, to confirm it looks right.
        </p>
        <div className="space-y-2 max-w-sm">
          <Label>Test Phone Number</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="919876543210" />
        </div>
        <Button disabled={!phone || sendTest.isPending} onClick={() => sendTest.mutate()}>
          {sendTest.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Send Test Message
        </Button>
      </CardContent>
    </Card>
  );
}
