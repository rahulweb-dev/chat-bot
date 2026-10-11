"use client";
import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { Loader2, MessageCircle, Plus, Save, Send, Trash2 } from "lucide-react";

export interface WhatsAppAlertsValue {
  enabled?: boolean;
  phones?: string[];
  templateName?: string;
  templateLanguage?: string;
}

export function WhatsAppAlertsCard({ initial }: { initial?: WhatsAppAlertsValue }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(!!initial?.enabled);
  const [phones, setPhones] = useState<string[]>(initial?.phones?.length ? initial.phones : [""]);
  const [templateName, setTemplateName] = useState(initial?.templateName ?? "");
  const [templateLanguage, setTemplateLanguage] = useState(initial?.templateLanguage || "en");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await axios.patch("/api/settings", {
        notifications: {
          whatsappAlerts: {
            enabled,
            phones: phones.map((p) => p.trim()).filter(Boolean).slice(0, 5),
            templateName: templateName.trim(),
            templateLanguage: templateLanguage.trim() || "en",
          },
        },
      });
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: "WhatsApp alerts saved" });
      return true;
    } catch {
      toast({ title: "Couldn't save WhatsApp alerts", variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!(await save())) return;
    setTesting(true);
    try {
      const { data } = await axios.post("/api/alerts/whatsapp-test");
      const r = data.data as { sent: number; failed: { to: string; error: string }[]; skipped?: string };
      if (r.skipped) toast({ title: "Test not sent", description: r.skipped, variant: "destructive" });
      else if (r.sent && !r.failed.length) toast({ title: `Test sent to ${r.sent} number${r.sent === 1 ? "" : "s"}`, description: "Check WhatsApp." });
      else toast({ title: `${r.sent} sent, ${r.failed.length} failed`, description: r.failed[0]?.error, variant: r.sent ? undefined : "destructive" });
    } catch {
      toast({ title: "Couldn't send the test", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-green-600" />WhatsApp lead alerts</CardTitle>
        <CardDescription>
          Get every new lead, and every visitor asking for a person, on WhatsApp within seconds. Sent from your connected
          WhatsApp Business number and charged to your WhatsApp wallet like any other message.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <Label htmlFor="wa-alerts-enabled">Send WhatsApp alerts</Label>
          <Switch id="wa-alerts-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2">
          <Label>Send to these numbers (up to 5)</Label>
          {phones.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Input
                id={`wa-alert-phone-${i}`}
                value={p}
                inputMode="tel"
                placeholder="98765 43210"
                aria-label={`Alert number ${i + 1}`}
                onChange={(e) => setPhones((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {phones.length > 1 && (
                <Button type="button" variant="ghost" size="icon" aria-label="Remove number" onClick={() => setPhones((list) => list.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          ))}
          {phones.length < 5 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setPhones((list) => [...list, ""])}>
              <Plus className="h-4 w-4 mr-1" /> Add number
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Indian numbers can be typed as 10 digits. Other countries need the + code.</p>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
          <div>
            <p className="text-sm font-medium">Message template (recommended)</p>
            <p className="text-xs text-muted-foreground mt-1">
              WhatsApp only delivers a plain message if the person messaged your business number in the last 24 hours. For alerts that
              always arrive, create a <b>Utility</b> template in <Link href="/dashboard/whatsapp" className="underline">WhatsApp → Templates</Link>{" "}
              with exactly 4 variables, for example:
            </p>
            <pre className="mt-2 text-xs bg-background border rounded p-2 whitespace-pre-wrap">New lead: {"{{1}}"}, phone {"{{2}}"}. Interested in {"{{3}}"}. Came from {"{{4}}"}.</pre>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem] gap-3">
            <div>
              <Label htmlFor="wa-alert-template">Approved template name</Label>
              <Input id="wa-alert-template" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="lead_alert" />
            </div>
            <div>
              <Label htmlFor="wa-alert-lang">Language code</Label>
              <Input id="wa-alert-lang" value={templateLanguage} onChange={(e) => setTemplateLanguage(e.target.value)} placeholder="en" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={saving || testing}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save WhatsApp alerts
          </Button>
          <Button type="button" variant="outline" onClick={sendTest} disabled={saving || testing}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Save and send a test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
