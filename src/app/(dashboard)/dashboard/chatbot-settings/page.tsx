"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  HelpCircle, Tag, Truck, Clock, Plus, Trash2, Save,
  Pencil, Check, X, Bot, MessageSquare, Brain, Code,
  Zap, ExternalLink, CheckCircle2, Circle, Copy, Reply,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface FAQ      { _id?: string; question: string; answer: string; isActive: boolean }
interface Offer    { _id?: string; title: string; description: string; validUntil?: string; isActive: boolean }
interface Vehicle  { _id?: string; name: string; category: string; payload: string; priceRange: string; description: string; isActive: boolean }
interface BizHour  { day: string; open: string; close: string; isClosed: boolean }
interface Training { _id?: string; trigger: string; keywords: string[]; response: string; isActive: boolean }
interface Config   {
  faqs: FAQ[]; offers: Offer[]; vehicles: Vehicle[];
  businessHours: BizHour[]; training: Training[];
  welcomeMessage: string; agentOnlineMessage: string; agentOfflineMessage: string;
}

// ── helpers ────────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  LCV: "bg-blue-100 text-blue-700",
  ICV: "bg-purple-100 text-purple-700",
  HCV: "bg-orange-100 text-orange-700",
  Bus: "bg-green-100 text-green-700",
  EV:  "bg-emerald-100 text-emerald-700",
};

async function patchConfig(body: Partial<Config>) {
  const r = await fetch("/api/chatbot-config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

// ── FAQ Tab ────────────────────────────────────────────────────────────────────
function FAQTab({ config, refetch }: { config: Config; refetch: () => void }) {
  const [faqs, setFaqs] = useState<FAQ[]>(config.faqs);
  const [newQ, setNewQ] = useState(""); const [newA, setNewA] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(updated: FAQ[]) {
    setSaving(true);
    const r = await patchConfig({ faqs: updated });
    setSaving(false);
    if (r.success) { setFaqs(updated); refetch(); toast({ title: "FAQs saved" }); }
  }

  function add() {
    if (!newQ.trim() || !newA.trim()) return;
    save([...faqs, { question: newQ, answer: newA, isActive: true }]);
    setNewQ(""); setNewA("");
  }

  function toggle(i: number) { const f = [...faqs]; f[i].isActive = !f[i].isActive; save(f); }
  function remove(i: number) { save(faqs.filter((_, idx) => idx !== i)); }
  function saveEdit(i: number, q: string, a: string) {
    const f = [...faqs]; f[i] = { ...f[i], question: q, answer: a };
    save(f); setEditIdx(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Add New FAQ</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Question" value={newQ} onChange={e => setNewQ(e.target.value)} />
          <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-20 resize-none" placeholder="Answer" value={newA} onChange={e => setNewA(e.target.value)} />
          <Button onClick={add} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Add FAQ
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {faqs.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No FAQs yet. Add your first FAQ above.</p>}
        {faqs.map((faq, i) => (
          <FAQRow key={i} faq={faq} onToggle={() => toggle(i)} onDelete={() => remove(i)} onSave={(q, a) => saveEdit(i, q, a)} isEditing={editIdx === i} onEdit={() => setEditIdx(i)} onCancel={() => setEditIdx(null)} />
        ))}
      </div>
    </div>
  );
}

function FAQRow({ faq, onToggle, onDelete, onSave, isEditing, onEdit, onCancel }: {
  faq: FAQ; onToggle: () => void; onDelete: () => void;
  onSave: (q: string, a: string) => void;
  isEditing: boolean; onEdit: () => void; onCancel: () => void;
}) {
  const [q, setQ] = useState(faq.question);
  const [a, setA] = useState(faq.answer);
  return (
    <Card className="border">
      <CardContent className="p-4">
        {isEditing ? (
          <div className="space-y-2">
            <Input value={q} onChange={e => setQ(e.target.value)} />
            <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-17.5 resize-none" value={a} onChange={e => setA(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onSave(q, a)} className="bg-indigo-600 hover:bg-indigo-700"><Check className="w-3 h-3 mr-1" />Save</Button>
              <Button size="sm" variant="outline" onClick={onCancel}><X className="w-3 h-3 mr-1" />Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">{faq.question}</p>
              <p className="text-xs text-gray-500 mt-1">{faq.answer}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={faq.isActive} onCheckedChange={onToggle} />
              <button onClick={onEdit} className="p-1 text-gray-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Offers Tab ─────────────────────────────────────────────────────────────────
function OffersTab({ config, refetch }: { config: Config; refetch: () => void }) {
  const [offers, setOffers] = useState<Offer[]>(config.offers);
  const [form, setForm] = useState({ title: "", description: "", validUntil: "" });
  const [saving, setSaving] = useState(false);

  async function save(updated: Offer[]) {
    setSaving(true);
    const r = await patchConfig({ offers: updated });
    setSaving(false);
    if (r.success) { setOffers(updated); refetch(); toast({ title: "Offers saved" }); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Add New Offer</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Offer title (e.g. Fleet Discount)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-20 resize-none" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Input placeholder="Valid Until (e.g. 31 Dec 2025)" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} />
          <Button onClick={() => { if (!form.title || !form.description) return; save([...offers, { ...form, isActive: true }]); setForm({ title: "", description: "", validUntil: "" }); }} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Add Offer
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {offers.map((o, i) => (
          <Card key={i} className={`border-l-4 ${o.isActive ? "border-l-green-400" : "border-l-gray-200"}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm">{o.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{o.description}</p>
                  {o.validUntil && <p className="text-xs text-orange-500 mt-1">Valid till: {o.validUntil}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={o.isActive} onCheckedChange={() => { const u = [...offers]; u[i].isActive = !u[i].isActive; save(u); }} />
                  <button onClick={() => save(offers.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {offers.length === 0 && <p className="col-span-2 text-sm text-gray-400 text-center py-8">No offers yet.</p>}
      </div>
    </div>
  );
}

// ── Vehicles Tab ───────────────────────────────────────────────────────────────
function VehiclesTab({ config, refetch }: { config: Config; refetch: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(config.vehicles);
  const [form, setForm] = useState({ name: "", category: "LCV", payload: "", priceRange: "", description: "" });
  const [saving, setSaving] = useState(false);

  async function save(updated: Vehicle[]) {
    setSaving(true);
    const r = await patchConfig({ vehicles: updated });
    setSaving(false);
    if (r.success) { setVehicles(updated); refetch(); toast({ title: "Vehicles saved" }); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Add Vehicle</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Input placeholder="Vehicle Name (e.g. Dost+)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <select className="border rounded-md px-3 py-2 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {["LCV", "ICV", "HCV", "Bus", "EV"].map(c => <option key={c}>{c}</option>)}
          </select>
          <Input placeholder="Payload (e.g. 1.5T)" value={form.payload} onChange={e => setForm({ ...form, payload: e.target.value })} />
          <Input placeholder="Price Range (e.g. ₹7-9L)" value={form.priceRange} onChange={e => setForm({ ...form, priceRange: e.target.value })} />
          <Input className="col-span-2" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Button className="col-span-2 bg-indigo-600 hover:bg-indigo-700" disabled={saving} onClick={() => { if (!form.name) return; save([...vehicles, { ...form, isActive: true }]); setForm({ name: "", category: "LCV", payload: "", priceRange: "", description: "" }); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Vehicle
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((v, i) => (
          <Card key={i} className={`border overflow-hidden ${!v.isActive ? "opacity-50" : ""}`}>
            <div className={`h-1 w-full ${v.isActive ? "bg-indigo-400" : "bg-gray-200"}`} />
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm">{v.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[v.category] || "bg-gray-100 text-gray-600"}`}>{v.category}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={v.isActive} onCheckedChange={() => { const u = [...vehicles]; u[i].isActive = !u[i].isActive; save(u); }} />
                  <button onClick={() => save(vehicles.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              {v.payload    && <p className="text-xs text-gray-500">Payload: {v.payload}</p>}
              {v.priceRange && <p className="text-xs text-gray-500">Price: {v.priceRange}</p>}
              {v.description && <p className="text-xs text-gray-400 mt-1 truncate">{v.description}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Business Hours Tab ─────────────────────────────────────────────────────────
function HoursTab({ config, refetch }: { config: Config; refetch: () => void }) {
  const [hours, setHours] = useState<BizHour[]>(config.businessHours);
  const [messages, setMessages] = useState({ welcome: config.welcomeMessage, online: config.agentOnlineMessage, offline: config.agentOfflineMessage });
  const [saving, setSaving] = useState(false);

  async function saveHours() {
    setSaving(true);
    const r = await patchConfig({ businessHours: hours, welcomeMessage: messages.welcome, agentOnlineMessage: messages.online, agentOfflineMessage: messages.offline });
    setSaving(false);
    if (r.success) { refetch(); toast({ title: "Settings saved" }); }
  }

  function update(i: number, field: keyof BizHour, val: string | boolean) {
    const u = [...hours];
    (u[i] as unknown as Record<string, string | boolean>)[field] = val;
    setHours(u);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Business Hours</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {hours.map((h, i) => (
              <div key={h.day} className="flex items-center gap-3">
                <div className="w-28 text-sm font-medium text-gray-700">{h.day}</div>
                <Switch checked={!h.isClosed} onCheckedChange={v => update(i, "isClosed", !v)} />
                {h.isClosed ? (
                  <span className="text-xs text-gray-400">Closed</span>
                ) : (
                  <>
                    <Input type="time" value={h.open}  onChange={e => update(i, "open",  e.target.value)} className="w-32 text-sm" />
                    <span className="text-xs text-gray-400">to</span>
                    <Input type="time" value={h.close} onChange={e => update(i, "close", e.target.value)} className="w-32 text-sm" />
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4" />Chatbot Messages</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Welcome Message</label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-17.5 resize-none" value={messages.welcome} onChange={e => setMessages({ ...messages, welcome: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Agent Online Message</label>
            <Input value={messages.online} onChange={e => setMessages({ ...messages, online: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Agent Offline Message</label>
            <Input value={messages.offline} onChange={e => setMessages({ ...messages, offline: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveHours} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
        <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save All Settings"}
      </Button>
    </div>
  );
}

// ── Training Tab ───────────────────────────────────────────────────────────────
function TrainingTab({ config, refetch }: { config: Config; refetch: () => void }) {
  const [entries, setEntries] = useState<Training[]>(config.training ?? []);
  const [mode, setMode] = useState<"form" | "json">("form");
  const [form, setForm] = useState({ trigger: "", keywords: "", response: "" });
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(updated: Training[]) {
    setSaving(true);
    const r = await patchConfig({ training: updated });
    setSaving(false);
    if (r.success) { setEntries(updated); refetch(); toast({ title: "Training saved" }); }
    else toast({ title: "Save failed", variant: "destructive" });
  }

  function addEntry() {
    if (!form.keywords.trim() || !form.response.trim()) return;
    const keywords = form.keywords.split(/[,\n]+/).map(k => k.trim()).filter(Boolean);
    save([...entries, { trigger: form.trigger.trim(), keywords, response: form.response.trim(), isActive: true }]);
    setForm({ trigger: "", keywords: "", response: "" });
  }

  function importJson() {
    setJsonError("");
    try {
      const parsed = JSON.parse(jsonText);
      let imported: Training[] = [];
      if (Array.isArray(parsed)) {
        imported = (parsed as Record<string, unknown>[]).map(item => ({
          trigger: String(item.trigger ?? ""),
          keywords: Array.isArray(item.keywords) ? (item.keywords as string[]) : [String(item.keyword ?? item.trigger ?? "")].filter(Boolean),
          response: String(item.response ?? ""),
          isActive: true,
        })).filter(e => e.keywords.length && e.response);
      } else if (typeof parsed === "object" && parsed !== null) {
        imported = Object.entries(parsed as Record<string, string>).map(([k, v]) => ({
          trigger: k, keywords: [k], response: String(v), isActive: true,
        }));
      }
      if (!imported.length) { setJsonError("No valid entries found in JSON."); return; }
      save([...entries, ...imported]);
      setJsonText("");
      toast({ title: `Imported ${imported.length} rules` });
    } catch {
      setJsonError("Invalid JSON — check the format and try again.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode("form")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${mode === "form" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          <Plus className="w-3.5 h-3.5" /> Manual Add
        </button>
        <button
          onClick={() => setMode("json")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${mode === "json" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          <Code className="w-3.5 h-3.5" /> Paste JSON
        </button>
      </div>

      {mode === "form" ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">Add Keyword → Response Rule</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Trigger Name <span className="text-gray-400">(optional label)</span></label>
              <Input placeholder="e.g. warranty, pricing, location" value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Keywords <span className="text-gray-400">(comma or newline separated — any match fires this rule)</span></label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm min-h-18 resize-none font-mono"
                placeholder={"warranty, guarantee, how long covered\nwhat is the warranty"}
                value={form.keywords}
                onChange={e => setForm({ ...form, keywords: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Bot Response</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm min-h-25 resize-none"
                placeholder="What the bot should reply when any keyword is matched in the user's message…"
                value={form.response}
                onChange={e => setForm({ ...form, response: e.target.value })}
              />
            </div>
            <Button onClick={addEntry} disabled={saving || !form.keywords.trim() || !form.response.trim()} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" /> Add Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Paste JSON Training Data</CardTitle>
            <p className="text-xs text-gray-500 mt-1">Supports two formats — paste either one below.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-gray-50 border rounded-md p-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Array format</p>
                <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{`[
  {
    "trigger": "warranty",
    "keywords": ["warranty", "guarantee"],
    "response": "All Ashok Leyland vehicles come with a 3-year standard warranty."
  }
]`}</pre>
              </div>
              <div className="bg-gray-50 border rounded-md p-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Map format (quick)</p>
                <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{`{
  "warranty": "3-year warranty on all models.",
  "price": "Call us at 1800-XXX for pricing.",
  "location": "Visit us at Sion, Mumbai."
}`}</pre>
              </div>
            </div>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm min-h-40 resize-none font-mono"
              placeholder="Paste your JSON here…"
              value={jsonText}
              onChange={e => { setJsonText(e.target.value); setJsonError(""); }}
            />
            {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
            <Button onClick={importJson} disabled={saving || !jsonText.trim()} className="bg-indigo-600 hover:bg-indigo-700">
              <Save className="w-4 h-4 mr-2" /> Import & Save
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Entry list */}
      <div className="space-y-2">
        {entries.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No training rules yet.</p>
            <p className="text-xs mt-1">Add rules above so the bot can respond to custom keywords.</p>
          </div>
        )}
        {entries.map((e, i) => (
          <Card key={i} className={`border transition-opacity ${!e.isActive ? "opacity-50" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {e.trigger && (
                    <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest mb-1.5">{e.trigger}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {e.keywords.map((k, ki) => (
                      <span key={ki} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full font-mono border border-indigo-100">{k}</span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{e.response}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={e.isActive}
                    onCheckedChange={() => { const u = [...entries]; u[i].isActive = !u[i].isActive; save(u); }}
                    className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-300"
                  />
                  <button onClick={() => save(entries.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Canned Responses Tab ───────────────────────────────────────────────────────
interface CannedResponse { _id?: string; title: string; shortcut: string; content: string; category: string; usageCount?: number }

function CannedTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", shortcut: "", content: "", category: "General" });
  const [saving, setSaving] = useState(false);

  const { data: items = [], isLoading } = useQuery<CannedResponse[]>({
    queryKey: ["canned-responses"],
    queryFn: () => fetch("/api/canned-responses").then(r => r.json()).then(d => d.data || []),
  });

  async function add() {
    if (!form.title || !form.shortcut || !form.content) return;
    setSaving(true);
    const r = await fetch("/api/canned-responses", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    }).then(r => r.json());
    setSaving(false);
    if (r.success) {
      toast({ title: "Canned response saved" });
      setForm({ title: "", shortcut: "", content: "", category: "General" });
      qc.invalidateQueries({ queryKey: ["canned-responses"] });
    } else { toast({ title: r.error, variant: "destructive" }); }
  }

  async function remove(id: string) {
    await fetch(`/api/canned-responses?id=${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["canned-responses"] });
    toast({ title: "Deleted" });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Reply className="w-4 h-4" />Add Canned Response</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Title</label>
              <Input placeholder="e.g. Greeting" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Shortcut <span className="text-gray-400">(type /shortcut in inbox)</span></label>
              <div className="flex">
                <span className="flex items-center px-3 border border-r-0 rounded-l-md bg-gray-50 text-gray-500 text-sm">/</span>
                <Input className="rounded-l-none" placeholder="hello" value={form.shortcut} onChange={e => setForm({ ...form, shortcut: e.target.value.replace(/[^a-z0-9_-]/gi, "").toLowerCase() })} />
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Category</label>
            <Input placeholder="General" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Response content</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm min-h-25 resize-none"
              placeholder="The full text the agent will send when they pick this response…"
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
            />
          </div>
          <Button onClick={add} disabled={saving || !form.title || !form.shortcut || !form.content} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Save Response
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {isLoading && <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />}
        {!isLoading && items.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <Reply className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No canned responses yet.</p>
            <p className="text-xs mt-1">Agents can type <code className="bg-gray-100 px-1 rounded">/shortcut</code> in the inbox to insert these instantly.</p>
          </div>
        )}
        {items.map(item => (
          <Card key={item._id} className="border border-gray-100 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                    <code className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-mono">/{item.shortcut}</code>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{item.category}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{item.content}</p>
                  {item.usageCount ? <p className="text-xs text-gray-400 mt-1">Used {item.usageCount}×</p> : null}
                </div>
                <button onClick={() => item._id && remove(item._id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Real-time Tab ──────────────────────────────────────────────────────────────
function RealtimeTab() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const steps = [
    {
      title: "Create a free Pusher account",
      desc: "Go to pusher.com, sign up for free. The free plan gives you 200 concurrent connections and 200,000 messages per day — enough for most businesses.",
      action: { label: "Open Pusher.com", href: "https://pusher.com" },
    },
    {
      title: "Create a new Channels app",
      desc: 'In the Pusher dashboard, click "Create app". Choose any name (e.g. "SupportFlow"), select your nearest cluster (e.g. ap2 for Asia Pacific), and click Create.',
      action: null,
    },
    {
      title: "Copy your App Keys",
      desc: 'Go to App Keys tab in your new Pusher app. You will see: App ID, Key, Secret, and Cluster. Copy all four.',
      action: null,
    },
    {
      title: "Add keys to your .env.local file",
      desc: "Open your .env.local file and fill in the four Pusher values below. Then restart your server.",
      action: null,
    },
    {
      title: "Restart the server",
      desc: "Stop and restart your Next.js server (npm run dev or your production process manager). The widget will automatically pick up Pusher — no changes to your embed snippet needed.",
      action: null,
    },
  ];

  const envBlock = `PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=ap2`;

  return (
    <div className="space-y-6">
      {/* What is Pusher */}
      <Card className="border-indigo-100 bg-indigo-50/40">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Why Pusher?</p>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                Without Pusher, your chat widget checks for new messages every 5 seconds (polling). With Pusher,
                messages from agents arrive <span className="font-semibold text-indigo-700">instantly</span> — no delay, no wasted requests.
                It works even on serverless hosting where Socket.IO cannot run.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                {[
                  { label: "Agent sends message", arrow: true },
                  { label: "Server triggers Pusher", arrow: true },
                  { label: "Widget receives in <100ms", arrow: false },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-white border border-indigo-200 text-indigo-700 text-xs font-medium rounded-full shadow-sm">{s.label}</span>
                    {s.arrow && <span className="text-indigo-300 text-sm">→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step-by-step guide */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Setup Guide</p>
        {steps.map((step, i) => (
          <Card key={i} className="border border-gray-100 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{step.title}</p>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{step.desc}</p>

                  {i === 3 && (
                    <div className="mt-3 relative">
                      <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-xl font-mono leading-relaxed overflow-x-auto whitespace-pre">
                        {envBlock}
                      </pre>
                      <button
                        onClick={() => copy(envBlock, "env")}
                        className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-md transition-colors"
                      >
                        {copied === "env" ? <><CheckCircle2 className="w-3 h-3 text-green-400" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                      </button>
                    </div>
                  )}

                  {step.action && (
                    <a
                      href={step.action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      {step.action.label} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Verification checklist */}
      <Card className="border border-gray-100 shadow-none">
        <CardContent className="p-5">
          <p className="font-semibold text-gray-900 text-sm mb-3">How to verify it&apos;s working</p>
          <div className="space-y-2.5">
            {[
              "Open your website where the widget is embedded",
              "Start a chat — go to Dashboard → Live Inbox and open the conversation",
              "Reply from the agent inbox",
              "The message should appear in the widget immediately (not after 5 seconds)",
              "Check Pusher dashboard → Event Explorer to see live events firing",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Circle className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600">{item}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Free plan note */}
      <div className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl p-4">
        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-sm text-green-800">
          <span className="font-semibold">Pusher free plan</span> — 200 concurrent connections, 200k messages/day. More than enough for a growing business. Upgrade only when needed.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ChatbotSettingsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["chatbot-config"],
    queryFn: async () => {
      const r = await fetch("/api/chatbot-config");
      const d = await r.json();
      return d.data as Config;
    },
    staleTime: 30_000,
  });

  function refetch() { qc.invalidateQueries({ queryKey: ["chatbot-config"] }); }

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
          <Bot className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Chatbot Settings</h1>
          <p className="text-sm text-gray-500">Manage FAQs, offers, vehicles, business hours, and training rules</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "FAQs",      value: data.faqs.length,          icon: HelpCircle, color: "bg-blue-50 text-blue-600" },
          { label: "Offers",    value: data.offers.length,        icon: Tag,        color: "bg-green-50 text-green-600" },
          { label: "Vehicles",  value: data.vehicles.length,      icon: Truck,      color: "bg-orange-50 text-orange-600" },
          { label: "Open Days", value: data.businessHours.filter(h => !h.isClosed).length, icon: Clock, color: "bg-purple-50 text-purple-600" },
          { label: "Training",  value: (data.training ?? []).length, icon: Brain,   color: "bg-indigo-50 text-indigo-600" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="training">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="training"  className="flex items-center gap-1"><Brain      className="w-3 h-3" />Training</TabsTrigger>
          <TabsTrigger value="faqs"      className="flex items-center gap-1"><HelpCircle className="w-3 h-3" />FAQs</TabsTrigger>
          <TabsTrigger value="offers"    className="flex items-center gap-1"><Tag        className="w-3 h-3" />Offers</TabsTrigger>
          <TabsTrigger value="vehicles"  className="flex items-center gap-1"><Truck      className="w-3 h-3" />Vehicles</TabsTrigger>
          <TabsTrigger value="hours"     className="flex items-center gap-1"><Clock      className="w-3 h-3" />Hours</TabsTrigger>
          <TabsTrigger value="canned"    className="flex items-center gap-1"><Reply      className="w-3 h-3" />Canned</TabsTrigger>
          <TabsTrigger value="realtime"  className="flex items-center gap-1"><Zap        className="w-3 h-3" />Real-time</TabsTrigger>
        </TabsList>
        <TabsContent value="training"  className="mt-6"><TrainingTab  config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="faqs"      className="mt-6"><FAQTab       config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="offers"    className="mt-6"><OffersTab    config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="vehicles"  className="mt-6"><VehiclesTab  config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="hours"     className="mt-6"><HoursTab     config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="canned"    className="mt-6"><CannedTab /></TabsContent>
        <TabsContent value="realtime"  className="mt-6"><RealtimeTab /></TabsContent>
      </Tabs>
    </div>
  );
}
