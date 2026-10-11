"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { CalendarCheck, CalendarSync, Clock, Save, BellRing, Plus } from "lucide-react";

export interface BookingSettings {
  enabled: boolean;
  label: string;
  slotMinutes: number;
  daysAhead: number;
  capacity: number;
  minNoticeHours: number;
  triggerLabels: string;
  reminderTemplate: string;
  reminderLanguage: string;
}

const DEFAULTS: BookingSettings = {
  enabled: false, label: "appointment", slotMinutes: 60, daysAhead: 7, capacity: 1, minNoticeHours: 2,
  triggerLabels: "", reminderTemplate: "", reminderLanguage: "en",
};

const clamp = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Number(v) || min));

// Two-way sync: busy times in the calendar hide slots, bookings appear in it.
function GoogleCalendarCard() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const result = params.get("calendar"); // set by the OAuth callback redirect
  const { data, isLoading } = useQuery({
    queryKey: ["google-calendar"],
    queryFn: async () => {
      const r = await fetch("/api/integrations/google-calendar");
      return (await r.json()).data as { available: boolean; connected: boolean; email?: string; error?: string };
    },
  });
  const disconnect = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/integrations/google-calendar", { method: "DELETE" });
      if (!r.ok) throw new Error();
    },
    onSuccess: () => { toast({ title: "Google Calendar disconnected" }); qc.invalidateQueries({ queryKey: ["google-calendar"] }); },
    onError: () => toast({ title: "Couldn't disconnect", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><CalendarSync className="w-4 h-4" /> Google Calendar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {result === "connected" && <p className="text-xs rounded-md bg-green-50 text-green-700 px-3 py-2">Google Calendar connected.</p>}
        {result === "error" && <p className="text-xs rounded-md bg-red-50 text-red-700 px-3 py-2">Couldn&apos;t connect Google Calendar. Please try again.</p>}
        <p className="text-xs text-gray-500">
          Times that are busy in your calendar aren&apos;t offered to visitors, and every booking is added to it with the visitor&apos;s
          name and number. Only busy/free times are read, never your event details.
        </p>
        {isLoading ? (
          <p className="text-xs text-gray-400">Checking…</p>
        ) : !data?.available ? (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">Google Calendar isn&apos;t set up on this server yet.</p>
        ) : data.connected ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm">Connected{data.email ? <> as <b>{data.email}</b></> : ""}</p>
            <Button variant="outline" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>Disconnect</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {data.error && <p className="text-xs text-red-600">The last connection stopped working: {data.error}. Connect again.</p>}
            <Button asChild variant="outline" size="sm">
              <a href="/api/integrations/google-calendar/connect">Connect Google Calendar</a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BookingTab({
  initial,
  menuLabels,
  onOpenHours,
  save,
}: {
  initial?: Partial<BookingSettings>;
  menuLabels: string[];
  onOpenHours: () => void;
  save: (b: BookingSettings) => Promise<{ success: boolean; error?: string }>;
}) {
  const [b, setB] = useState<BookingSettings>({ ...DEFAULTS, ...(initial ?? {}) });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<BookingSettings>) => setB((x) => ({ ...x, ...patch }));
  const triggers = b.triggerLabels.split(",").map((t) => t.trim()).filter(Boolean);

  async function onSave() {
    if (!b.label.trim()) { toast({ title: "Say what visitors are booking, e.g. site visit", variant: "destructive" }); return; }
    setSaving(true);
    const r = await save({ ...b, label: b.label.trim().toLowerCase(), triggerLabels: triggers.join(", ") });
    setSaving(false);
    if (r.success) toast({ title: "Booking settings saved", description: b.enabled ? "Visitors can now book in the chat." : undefined });
    else toast({ title: r.error || "Couldn't save", variant: "destructive" });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-xs text-indigo-800">
        Visitors pick a day and a free time in the chat. Free times come from your{" "}
        <button type="button" onClick={onOpenHours} className="font-semibold underline underline-offset-2">Business Hours</button>{" "}
        and your timezone. Every booking becomes a lead, shows up under Bookings, and is sent to your WhatsApp if lead alerts are on.
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><CalendarCheck className="w-4 h-4" /> Booking in chat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <label htmlFor="bk-enabled" className="text-sm font-medium text-gray-700">Let visitors book in the chat</label>
            <Switch id="bk-enabled" checked={b.enabled} onCheckedChange={(v) => set({ enabled: v })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bk-label" className="text-xs font-medium text-gray-600 mb-1 block">What visitors book</label>
              <Input id="bk-label" value={b.label} onChange={(e) => set({ label: e.target.value })} placeholder="site visit" maxLength={40} />
              <p className="text-[11px] text-gray-400 mt-1">Shown as &quot;📅 Book a {b.label || "…"}&quot; in the chat menu.</p>
            </div>
            <div>
              <label htmlFor="bk-slot" className="text-xs font-medium text-gray-600 mb-1 block">Each booking lasts</label>
              <select
                id="bk-slot"
                value={b.slotMinutes}
                onChange={(e) => set({ slotMinutes: Number(e.target.value) })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bk-days" className="text-xs font-medium text-gray-600 mb-1 block">Visitors can book up to (days ahead)</label>
              <Input id="bk-days" type="number" min={1} max={30} value={b.daysAhead} onChange={(e) => set({ daysAhead: clamp(e.target.value, 1, 30) })} />
            </div>
            <div>
              <label htmlFor="bk-cap" className="text-xs font-medium text-gray-600 mb-1 block">Bookings allowed per time slot</label>
              <Input id="bk-cap" type="number" min={1} max={50} value={b.capacity} onChange={(e) => set({ capacity: clamp(e.target.value, 1, 50) })} />
              <p className="text-[11px] text-gray-400 mt-1">E.g. 3 if three sales staff can each host a visit.</p>
            </div>
            <div>
              <label htmlFor="bk-notice" className="text-xs font-medium text-gray-600 mb-1 block">Minimum notice (hours)</label>
              <Input id="bk-notice" type="number" min={0} max={72} value={b.minNoticeHours} onChange={(e) => set({ minNoticeHours: clamp(e.target.value, 0, 72) })} />
            </div>
          </div>

          <div>
            <label htmlFor="bk-triggers" className="text-xs font-medium text-gray-600 mb-1 block">Menu buttons that start booking (optional)</label>
            <Input
              id="bk-triggers"
              value={b.triggerLabels}
              onChange={(e) => set({ triggerLabels: e.target.value })}
              placeholder="Plan a Walkthrough, Book a demo"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              If your menu already has a button like &quot;Plan a Walkthrough&quot;, add it here and it opens the slot picker instead of a separate button.
            </p>
            {menuLabels.filter((l) => !triggers.some((t) => t.toLowerCase() === l.toLowerCase())).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {menuLabels
                  .filter((l) => !triggers.some((t) => t.toLowerCase() === l.toLowerCase()))
                  .map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => set({ triggerLabels: [...triggers, l].join(", ") })}
                      className="text-xs px-2 py-1 rounded-full border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> {l}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <GoogleCalendarCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><BellRing className="w-4 h-4" /> WhatsApp reminder to the visitor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">
            Sent about a day before (and at least 2 hours before) each booking, from your connected WhatsApp number. WhatsApp requires an
            approved <b>Utility</b> template with 4 variables, for example:
          </p>
          <pre className="text-xs bg-gray-50 border rounded p-2 whitespace-pre-wrap">Hi {"{{1}}"}, a reminder of your {"{{2}}"} on {"{{3}}"} with {"{{4}}"}. Reply here if you need to change it.</pre>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem] gap-3">
            <div>
              <label htmlFor="bk-tpl" className="text-xs font-medium text-gray-600 mb-1 block">Approved template name</label>
              <Input id="bk-tpl" value={b.reminderTemplate} onChange={(e) => set({ reminderTemplate: e.target.value })} placeholder="booking_reminder" />
            </div>
            <div>
              <label htmlFor="bk-lang" className="text-xs font-medium text-gray-600 mb-1 block">Language code</label>
              <Input id="bk-lang" value={b.reminderLanguage} onChange={(e) => set({ reminderLanguage: e.target.value })} placeholder="en" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Leave empty to skip reminders.</p>
        </CardContent>
      </Card>

      <Button onClick={onSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
        <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save booking settings"}
      </Button>
    </div>
  );
}
