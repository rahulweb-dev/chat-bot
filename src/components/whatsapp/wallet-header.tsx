"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Wallet, Link2, Copy, Check, Gauge, TrendingDown, ShieldAlert, Gift, Loader2 } from "lucide-react";

interface WalletSummary {
  balance: number;
  currency: string;
  perMessageCost: number;
  dailyLimit: number;
  dailyUsed: number;
  remainingToday: number;
}

function LinkGeneratorDialog() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("Hi! I'm interested in learning more.");
  const [copied, setCopied] = useState(false);

  const { data: integration } = useQuery<{ displayPhoneNumber?: string } | null>({
    queryKey: ["whatsapp-integration"],
    queryFn: () => axios.get("/api/whatsapp/integration").then((r) => r.data.data),
    enabled: open,
  });

  const phone = integration?.displayPhoneNumber?.replace(/[^\d]/g, "");
  const link = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: "Link copied" });
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Link2 className="h-3.5 w-3.5 mr-1.5" />Link Generator
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>WhatsApp Click-to-Chat Link</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!phone ? (
            <p className="text-sm text-muted-foreground">Connect WhatsApp in Settings first to generate a link.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Pre-filled message</Label>
                <Input value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Shareable Link</Label>
                <div className="flex gap-2">
                  <Input value={link || ""} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copy}>
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WalletHeader() {
  const qc = useQueryClient();
  const { data: wallet } = useQuery<WalletSummary>({
    queryKey: ["whatsapp-wallet"],
    queryFn: () => axios.get("/api/whatsapp/wallet").then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const claimTrialCredits = useMutation({
    mutationFn: () => axios.post("/api/whatsapp/wallet"),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-wallet"] });
      toast({ title: res.data.message || "Trial credits added" });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to claim credits";
      toast({ title: msg, variant: "destructive" });
    },
  });

  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b bg-white flex-wrap">
      <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-[10px] px-4 py-2">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <Wallet className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[11px] text-blue-700/70 leading-none">Wallet Balance</p>
          <p className="text-sm font-semibold text-blue-900 leading-tight">
            {wallet ? `${wallet.currency} ${wallet.balance.toFixed(2)}` : "—"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 border rounded-[10px] px-4 py-2">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <Gauge className="w-4 h-4 text-gray-600" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground leading-none">Daily Limit</p>
          <p className="text-sm font-semibold leading-tight">{wallet?.dailyLimit ?? "—"} msgs/day</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 border rounded-[10px] px-4 py-2">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <TrendingDown className="w-4 h-4 text-gray-600" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground leading-none">Left Today</p>
          <p className="text-sm font-semibold leading-tight">{wallet?.remainingToday ?? "—"} remaining</p>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {wallet && wallet.balance < 1 ? (
          <Button
            size="sm"
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-50"
            onClick={() => claimTrialCredits.mutate()}
            disabled={claimTrialCredits.isPending}
          >
            {claimTrialCredits.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Gift className="h-3.5 w-3.5 mr-1.5" />
            )}
            Get ₹50 Trial Credits
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldAlert className="w-3.5 h-3.5" />
            Need more credits? Contact your platform admin.
          </div>
        )}
        <LinkGeneratorDialog />
      </div>
    </div>
  );
}
