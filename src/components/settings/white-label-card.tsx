"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { BadgeCheck, Loader2, Lock, Save } from "lucide-react";

type Saved = { brandName?: string; brandLogo?: string; hideBranding?: boolean; poweredByText?: string; poweredByUrl?: string };

function WhiteLabelForm({ saved }: { saved: Saved }) {
  const qc = useQueryClient();
  const [brandName, setBrandName] = useState(saved.brandName ?? "");
  const [brandLogo, setBrandLogo] = useState(saved.brandLogo ?? "");
  const [hideBranding, setHideBranding] = useState(!!saved.hideBranding);
  const [poweredByText, setPoweredByText] = useState(saved.poweredByText ?? "");
  const [poweredByUrl, setPoweredByUrl] = useState(saved.poweredByUrl ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/white-label", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName: brandName.trim(), brandLogo: brandLogo.trim(), hideBranding, poweredByText: poweredByText.trim(), poweredByUrl: poweredByUrl.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(d.error || "Couldn't save branding");
      toast({ title: "Branding saved", description: "The widget updates within a minute." });
      qc.invalidateQueries({ queryKey: ["branding"] });
      qc.invalidateQueries({ queryKey: ["white-label"] });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Couldn't save branding", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="wl-name">Dashboard name</Label>
          <Input id="wl-name" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your agency's product name" maxLength={40} />
          <p className="text-xs text-muted-foreground mt-1">Shown instead of &quot;Convo360&quot; in this account&apos;s dashboard.</p>
        </div>
        <div>
          <Label htmlFor="wl-logo">Dashboard logo URL</Label>
          <Input id="wl-logo" value={brandLogo} onChange={(e) => setBrandLogo(e.target.value)} placeholder="https://…/logo.png" />
        </div>
      </div>
      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="wl-hide">Hide &quot;Powered by Convo360&quot; in the chat widget</Label>
          <Switch id="wl-hide" checked={hideBranding} onCheckedChange={setHideBranding} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="wl-pwr-text">Or show your own: &quot;Powered by …&quot;</Label>
            <Input id="wl-pwr-text" value={poweredByText} onChange={(e) => setPoweredByText(e.target.value)} placeholder="Your agency" maxLength={60} />
          </div>
          <div>
            <Label htmlFor="wl-pwr-url">Link</Label>
            <Input id="wl-pwr-url" value={poweredByUrl} onChange={(e) => setPoweredByUrl(e.target.value)} placeholder="https://youragency.com" />
          </div>
        </div>
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Save branding
      </Button>
    </div>
  );
}

// White labeling for agencies reselling Convo360 under their own brand.
export function WhiteLabelCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["white-label"],
    queryFn: async () => (await (await fetch("/api/white-label")).json()).data as { allowed: boolean; saved: Saved },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BadgeCheck className="h-4 w-4" />White label</CardTitle>
        <CardDescription>Resell under your own brand: your name and logo in the dashboard, and your name (or nothing) in the chat widget.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !data?.allowed ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            <span>White labeling is included in the Enterprise plan. <Link href="/dashboard/billing" className="underline font-medium text-foreground">See plans</Link></span>
          </div>
        ) : (
          <WhiteLabelForm saved={data.saved ?? {}} />
        )}
      </CardContent>
    </Card>
  );
}
