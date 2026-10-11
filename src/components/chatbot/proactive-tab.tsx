"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Megaphone, Plus, Save, Trash2 } from "lucide-react";

export interface ProactiveRule {
  _id?: string;
  enabled: boolean;
  message: string;
  urlContains: string;
  delaySeconds: number;
}

// Starting points that show what good proactive messages look like.
const EXAMPLES: Omit<ProactiveRule, "_id">[] = [
  { enabled: true, message: "Want the price list for our 3 BHK homes? I can share it here.", urlContains: "pricing", delaySeconds: 20 },
  { enabled: true, message: "Planning a site visit? I can book a slot for you in a minute.", urlContains: "", delaySeconds: 40 },
];

export function ProactiveTab({
  initial,
  save,
}: {
  initial: ProactiveRule[];
  save: (rules: ProactiveRule[]) => Promise<{ success: boolean; error?: string }>;
}) {
  const [rules, setRules] = useState<ProactiveRule[]>(initial);
  const [saving, setSaving] = useState(false);

  function update(i: number, patch: Partial<ProactiveRule>) {
    setRules((r) => r.map((rule, j) => (j === i ? { ...rule, ...patch } : rule)));
  }

  async function onSave() {
    const bad = rules.findIndex((r) => !r.message.trim());
    if (bad !== -1) {
      toast({ title: `Message ${bad + 1} is empty`, description: "Write a message or delete that row.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await save(rules.map((r) => ({ ...r, message: r.message.trim(), urlContains: r.urlContains.trim() })));
    setSaving(false);
    if (res.success) toast({ title: "Proactive messages saved", description: "Live on your website within a minute." });
    else toast({ title: res.error || "Couldn't save", variant: "destructive" });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-xs text-indigo-800">
        The chat button shows your message as a speech bubble after a visitor has spent some time on a page, without them clicking anything.
        Each visitor sees one per visit, and never while the chat is open. The first matching message from the top is used, so put
        page-specific messages above general ones.
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Megaphone className="w-4 h-4" /> Proactive messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.length === 0 && (
            <div className="text-sm text-gray-500 space-y-3">
              <p>No proactive messages yet. Start from an example:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <Button key={ex.message} variant="outline" size="sm" onClick={() => setRules((r) => [...r, { ...ex }])}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> {ex.message.slice(0, 38)}…
                  </Button>
                ))}
              </div>
            </div>
          )}

          {rules.map((rule, i) => (
            <div key={rule._id ?? i} className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={rule.enabled} onCheckedChange={(v) => update(i, { enabled: v })} aria-label="Enabled" />
                  <span className="text-xs font-medium text-gray-600">{rule.enabled ? "On" : "Off"}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setRules((r) => r.filter((_, j) => j !== i))} aria-label="Delete message">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>

              <div>
                <label htmlFor={`pro-msg-${i}`} className="text-xs font-medium text-gray-600 mb-1 block">Message</label>
                <Input
                  id={`pro-msg-${i}`}
                  value={rule.message}
                  maxLength={160}
                  onChange={(e) => update(i, { message: e.target.value })}
                  placeholder="Want the price list for 3 BHK? I can share it here."
                />
                <p className="text-[11px] text-gray-400 mt-1">{rule.message.length}/160 · Short questions get the most replies.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`pro-url-${i}`} className="text-xs font-medium text-gray-600 mb-1 block">Show on pages whose address contains</label>
                  <Input
                    id={`pro-url-${i}`}
                    value={rule.urlContains}
                    onChange={(e) => update(i, { urlContains: e.target.value })}
                    placeholder="e.g. pricing  (leave empty for every page)"
                  />
                </div>
                <div>
                  <label htmlFor={`pro-delay-${i}`} className="text-xs font-medium text-gray-600 mb-1 block">After the visitor has been on the page for</label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`pro-delay-${i}`}
                      type="number"
                      min={0}
                      max={600}
                      value={rule.delaySeconds}
                      onChange={(e) => update(i, { delaySeconds: Math.max(0, Math.min(600, Number(e.target.value) || 0)) })}
                      className="w-24"
                    />
                    <span className="text-sm text-gray-500">seconds</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {rules.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRules((r) => [...r, { enabled: true, message: "", urlContains: "", delaySeconds: 20 }])}
            >
              <Plus className="w-4 h-4 mr-1" /> Add message
            </Button>
          )}
        </CardContent>
      </Card>

      <Button onClick={onSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
        <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save proactive messages"}
      </Button>
    </div>
  );
}
