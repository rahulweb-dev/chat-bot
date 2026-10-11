"use client";
import { useState } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Save, Send, Sunrise } from "lucide-react";

export interface DailyDigestValue {
  enabled?: boolean;
  hour?: number;
  email?: boolean;
  whatsappTemplate?: string;
  whatsappLanguage?: string;
}

const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString("en-IN", { hour: "numeric", hour12: true });

export function DailyDigestCard({ initial }: { initial?: DailyDigestValue }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(initial?.enabled !== false);
  const [hour, setHour] = useState(initial?.hour ?? 9);
  const [email, setEmail] = useState(initial?.email !== false);
  const [template, setTemplate] = useState(initial?.whatsappTemplate ?? "");
  const [language, setLanguage] = useState(initial?.whatsappLanguage || "en");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function save() {
    setSaving(true);
    try {
      // Dotted keys so the saved lastSentOn marker isn't overwritten.
      await axios.patch("/api/settings", {
        "notifications.dailyDigest.enabled": enabled,
        "notifications.dailyDigest.hour": hour,
        "notifications.dailyDigest.email": email,
        "notifications.dailyDigest.whatsappTemplate": template.trim(),
        "notifications.dailyDigest.whatsappLanguage": language.trim() || "en",
      });
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "Daily summary saved" });
      return true;
    } catch {
      toast({ title: "Couldn't save the daily summary settings", variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendNow() {
    if (!(await save())) return;
    setSending(true);
    try {
      const { data } = await axios.post("/api/alerts/digest-test");
      const r = data.data as { emailed: number; whatsapped: number };
      if (r.emailed || r.whatsapped) {
        toast({ title: "Summary sent", description: [r.emailed && `${r.emailed} email${r.emailed === 1 ? "" : "s"}`, r.whatsapped && `${r.whatsapped} WhatsApp`].filter(Boolean).join(" and ") });
      } else {
        toast({ title: "Nothing was sent", description: "Check that email (SMTP) is set up, or that WhatsApp alert numbers and a template are saved.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Couldn't send the summary", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sunrise className="h-4 w-4 text-amber-500" />Daily summary</CardTitle>
        <CardDescription>
          Every morning: yesterday&apos;s chats, leads and bookings, where the leads came from, and anyone still waiting for a reply.
          Sent to company admins. Skipped on days with no activity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <Label htmlFor="dd-enabled">Send the daily summary</Label>
          <Switch id="dd-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dd-hour">Send at (your timezone)</Label>
            <select
              id="dd-hour"
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
          <div className="flex items-end justify-between gap-3 pb-2">
            <Label htmlFor="dd-email">By email</Label>
            <Switch id="dd-email" checked={email} onCheckedChange={setEmail} />
          </div>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            <b>Also on WhatsApp</b> (optional): goes to the numbers in WhatsApp lead alerts above. Needs an approved Utility template with
            4 variables: chats, leads, bookings and top lead source. For example:
          </p>
          <pre className="text-xs bg-background border rounded p-2 whitespace-pre-wrap">Yesterday on your website: {"{{1}}"} chats, {"{{2}}"} leads, {"{{3}}"} bookings. Most leads came from {"{{4}}"}.</pre>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem] gap-3">
            <div>
              <Label htmlFor="dd-tpl">Approved template name</Label>
              <Input id="dd-tpl" value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="daily_summary" />
            </div>
            <div>
              <Label htmlFor="dd-lang">Language code</Label>
              <Input id="dd-lang" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="en" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={saving || sending}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save daily summary
          </Button>
          <Button type="button" variant="outline" onClick={sendNow} disabled={saving || sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Save and send one now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
