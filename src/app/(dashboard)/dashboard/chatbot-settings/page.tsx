"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  HelpCircle, Tag, Truck, Clock, Plus, Trash2, Save,
  Pencil, Check, X, Bot, MessageSquare, Brain, Code, Workflow, ToggleLeft,
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
  customFlow?: { enabled: boolean; flow: Record<string, unknown> | null };
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
          <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] resize-none" placeholder="Answer" value={newA} onChange={e => setNewA(e.target.value)} />
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
            <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[70px] resize-none" value={a} onChange={e => setA(e.target.value)} />
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
          <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] resize-none" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
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
            <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[70px] resize-none" value={messages.welcome} onChange={e => setMessages({ ...messages, welcome: e.target.value })} />
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
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[72px] resize-none font-mono"
                placeholder={"warranty, guarantee, how long covered\nwhat is the warranty"}
                value={form.keywords}
                onChange={e => setForm({ ...form, keywords: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Bot Response</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[100px] resize-none"
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
              className="w-full border rounded-md px-3 py-2 text-sm min-h-[160px] resize-none font-mono"
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

// ── Flow Tab ───────────────────────────────────────────────────────────────────
const EXAMPLE_FLOW = `{
  "chatbot": {
    "name": "My Dealership Bot",
    "welcomeMessage": "👋 Welcome! I can help you explore vehicles, book a test drive, or calculate your EMI.",
    "mainMenu": [
      {
        "id": "cars",
        "title": "🚗 Cars",
        "actions": [
          { "step": "Ask Budget" },
          { "step": "Ask Fuel Type" },
          { "step": "Ask Transmission" },
          { "options": ["View Sedan Models", "View SUV Models", "Talk to Sales Executive"] }
        ]
      },
      {
        "id": "testDrive",
        "title": "📅 Book Test Drive",
        "actions": [
          { "step": "Select Vehicle" },
          { "step": "Select City" },
          { "step": "Enter Name" },
          { "step": "Enter Mobile" },
          { "step": "Choose Date" },
          { "step": "Choose Time" }
        ]
      },
      {
        "id": "emi",
        "title": "💳 EMI Calculator",
        "actions": [
          { "step": "Enter Vehicle Price" },
          { "step": "Enter Down Payment" },
          { "step": "Enter Interest Rate" },
          { "step": "Enter Loan Tenure" }
        ]
      }
    ]
  }
}`;

type FlowMenu = { id: string; title: string; actions: Record<string, unknown>[] };

function FlowTab({ config, refetch }: { config: Config; refetch: () => void }) {
  const enabled = config.customFlow?.enabled ?? false;
  const existingFlow = config.customFlow?.flow;
  const [jsonText, setJsonText] = useState(existingFlow ? JSON.stringify(existingFlow, null, 2) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [showExample, setShowExample] = useState(false);

  async function toggleEnabled() {
    setToggling(true);
    const r = await fetch("/api/chatbot-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customFlow: { enabled: !enabled, flow: existingFlow ?? null } }),
    });
    const d = await r.json();
    setToggling(false);
    if (d.success) { refetch(); toast({ title: !enabled ? "✅ Custom flow activated" : "Custom flow disabled" }); }
  }

  async function saveFlow() {
    setError("");
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(jsonText); }
    catch { setError('Invalid JSON. Check your syntax — missing quotes, commas, or brackets are common issues.'); return; }
    if (!parsed.chatbot) { setError('Your JSON must have a top-level "chatbot" key. See the example below.'); return; }
    setSaving(true);
    const r = await fetch("/api/chatbot-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customFlow: { enabled, flow: parsed } }),
    });
    const d = await r.json();
    setSaving(false);
    if (d.success) { refetch(); toast({ title: "Flow saved! You can now enable it." }); }
    else setError(d.error ?? "Save failed");
  }

  const savedMenus: FlowMenu[] = (() => {
    if (!existingFlow) return [];
    try {
      const def = existingFlow as { chatbot?: { mainMenu?: FlowMenu[] } };
      return def.chatbot?.mainMenu ?? [];
    } catch { return []; }
  })();

  const savedName: string = (() => {
    if (!existingFlow) return "";
    try { return (existingFlow as { chatbot?: { name?: string } }).chatbot?.name ?? ""; }
    catch { return ""; }
  })();

  const savedWelcome: string = (() => {
    if (!existingFlow) return "";
    try { return (existingFlow as { chatbot?: { welcomeMessage?: string } }).chatbot?.welcomeMessage ?? ""; }
    catch { return ""; }
  })();

  const statusColor = !existingFlow
    ? "border-gray-200 bg-gray-50"
    : enabled
    ? "border-green-200 bg-green-50"
    : "border-amber-200 bg-amber-50";

  const statusText = !existingFlow
    ? { label: "No Flow Uploaded", sub: "Paste your JSON below and save to get started.", color: "text-gray-500", dot: "bg-gray-400" }
    : enabled
    ? { label: "Flow Active", sub: "Your custom flow is live on the widget.", color: "text-green-700", dot: "bg-green-500" }
    : { label: "Flow Saved — Not Active", sub: "Enable it below to make it live on your widget.", color: "text-amber-700", dot: "bg-amber-500" };

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Step guide ── */}
      <Card className="border-0 bg-gradient-to-br from-indigo-50 to-violet-50 shadow-none">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-indigo-900 mb-4">How to set up your custom chatbot flow</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { n: "1", icon: "📝", title: "Design your flow", desc: "Write your chatbot menus and steps in JSON format" },
              { n: "2", icon: "📋", title: "Paste the JSON", desc: "Copy-paste your flow into the editor below" },
              { n: "3", icon: "💾", title: "Save", desc: "Click Save Flow to upload it to your account" },
              { n: "4", icon: "✅", title: "Enable", desc: "Turn on the toggle — your widget will use this flow instantly" },
            ].map(s => (
              <div key={s.n} className="flex gap-2.5 bg-white/70 rounded-xl p-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{s.icon} {s.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Status + enable ── */}
      <Card className={`border ${statusColor}`}>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusText.dot}`} />
            <div>
              <p className={`text-sm font-semibold ${statusText.color}`}>{statusText.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{statusText.sub}</p>
            </div>
          </div>
          {existingFlow && (
            <button
              onClick={toggleEnabled}
              disabled={toggling}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                enabled
                  ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                  : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <span className={`w-4 h-2.5 rounded-full transition-colors ${enabled ? "bg-white/80" : "bg-gray-300"}`} />
              {toggling ? "Saving…" : enabled ? "Enabled — Click to Disable" : "Click to Enable"}
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Live preview of saved flow ── */}
      {savedMenus.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-sm">Saved Flow Preview</CardTitle>
                {savedName && <p className="text-xs text-indigo-600 font-medium mt-0.5">{savedName}</p>}
              </div>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-medium">{savedMenus.length} menu items</span>
            </div>
            {savedWelcome && (
              <div className="mt-2 bg-gray-50 border rounded-lg px-3 py-2 text-xs text-gray-600 italic">
                "{savedWelcome}"
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-2 sm:grid-cols-2">
              {savedMenus.map((menu, i) => {
                const steps = menu.actions
                  .filter((a): a is { step: string } => "step" in a)
                  .map(a => a.step);
                const opts = (menu.actions.find(a => "options" in a) as { options?: string[] } | undefined)?.options ?? [];
                return (
                  <div key={i} className="border rounded-lg p-3 bg-white">
                    <p className="text-sm font-medium text-gray-800">{menu.title}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5 mb-2">id: {menu.id}</p>
                    {steps.length > 0 && (
                      <div className="space-y-1">
                        {steps.map((s, si) => (
                          <div key={si} className="flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center shrink-0">{si + 1}</span>
                            <span className="text-xs text-gray-600">{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {opts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {opts.map((o, oi) => (
                          <span key={oi} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2 py-0.5">{o}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── JSON editor ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Paste Your Flow JSON</CardTitle>
              <p className="text-xs text-gray-500 mt-1">Must start with a <code className="bg-gray-100 px-1 rounded font-mono">{`{ "chatbot": { ... } }`}</code> structure.</p>
            </div>
            <button
              onClick={() => setShowExample(v => !v)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 border border-indigo-200 rounded-md px-2 py-1"
            >
              <Code className="w-3 h-3" /> {showExample ? "Hide" : "Show"} Example
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showExample && (
            <div className="rounded-xl bg-gray-950 p-4 relative">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-semibold">Example JSON — click to copy into editor</p>
              <pre className="text-[11px] text-green-300 font-mono overflow-auto max-h-72 leading-relaxed">{EXAMPLE_FLOW}</pre>
              <button
                onClick={() => { setJsonText(EXAMPLE_FLOW); setShowExample(false); toast({ title: "Example loaded into editor" }); }}
                className="mt-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md font-medium"
              >
                Use This Example
              </button>
            </div>
          )}

          <textarea
            className="w-full border rounded-lg px-3 py-3 text-xs min-h-80 resize-y font-mono bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
            placeholder={`Paste your flow JSON here…\n\nClick "Show Example" above to see the format.`}
            value={jsonText}
            onChange={e => { setJsonText(e.target.value); setError(""); }}
            spellCheck={false}
          />

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <X className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={saveFlow} disabled={saving || !jsonText.trim()} className="bg-indigo-600 hover:bg-indigo-700">
              <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save Flow"}
            </Button>
            {existingFlow && (
              <button
                onClick={() => { setJsonText(JSON.stringify(existingFlow, null, 2)); setError(""); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Reset to last saved
              </button>
            )}
          </div>

          {/* Supported step names guide */}
          <details className="group mt-2">
            <summary className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer select-none font-medium">
              📖 What step names can I use?
            </summary>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[
                "Ask Budget", "Ask Fuel Type", "Ask Transmission", "Ask Usage",
                "Ask Mileage Requirement", "Ask Daily Running", "Ask Charging Preference",
                "Ask Business Type", "Ask Payload Requirement",
                "Select Brand", "Select State", "Select City", "Select Dealer",
                "Enter Name", "Enter Mobile", "Enter Email", "Select Vehicle",
                "Choose Date", "Choose Time",
                "Enter Vehicle Price", "Enter Down Payment", "Enter Interest Rate", "Enter Loan Tenure",
                "Select Vehicle 1", "Select Vehicle 2",
              ].map(s => (
                <span key={s} className="text-[10px] font-mono bg-gray-100 text-gray-600 rounded px-2 py-1 truncate">{s}</span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-gray-400">Use these exact names in your <code className="bg-gray-100 px-1 rounded">step</code> actions. The bot will ask the matching question automatically.</p>
          </details>
        </CardContent>
      </Card>

      {/* ── Live preview (only when flow is saved) ── */}
      {existingFlow && <FlowLivePreview botName={savedName} accentColor="#6366f1" />}

    </div>
  );
}

// ── Embedded live chat preview for Flow tab ────────────────────────────────────
type ChatMsg = { from: "bot" | "user"; text: string; time: string };

function FlowLivePreview({ botName, accentColor }: { botName: string; accentColor: string }) {
  const [msgs, setMsgs]   = useState<ChatMsg[]>([]);
  const [qrs, setQRs]     = useState<string[]>([]);
  const [sess, setSess]   = useState<Record<string, unknown>>({});
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const ts = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typing]);

  useEffect(() => {
    let cancelled = false;
    setMsgs([]); setQRs([]); setSess({}); setInput(""); setTyping(true);
    (async () => {
      try {
        const res  = await fetch("/api/widget/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "__INIT__", sessionData: {} }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          for (const text of (data.data.messages as string[])) {
            if (cancelled) return;
            await new Promise<void>(r => setTimeout(r, 250));
            if (!cancelled) setMsgs(p => [...p, { from: "bot", text, time: ts() }]);
          }
          if (!cancelled) { setQRs(data.data.quickReplies || []); setSess(data.data.sessionData || {}); }
        }
      } catch { /* ignore */ }
      if (!cancelled) { setTyping(false); setTimeout(() => inputRef.current?.focus(), 100); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const send = async (msg: string) => {
    const text = msg.trim();
    if (!text || typing) return;
    const snap = sess;
    setMsgs(p => [...p, { from: "user", text, time: ts() }]);
    setQRs([]); setInput(""); setTyping(true);
    try {
      const res  = await fetch("/api/widget/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionData: snap }),
      });
      const data = await res.json();
      if (data.success) {
        for (const m of (data.data.messages as string[])) {
          await new Promise<void>(r => setTimeout(r, 250));
          setMsgs(p => [...p, { from: "bot", text: m, time: ts() }]);
        }
        setQRs(data.data.quickReplies || []);
        setSess(data.data.sessionData || {});
      }
    } catch { /* ignore */ }
    setTyping(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <CardTitle className="text-sm">Live Preview — Test Your Flow</CardTitle>
          </div>
          <button
            onClick={() => setResetKey(k => k + 1)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 border rounded-md px-2 py-1 transition-colors hover:border-gray-300"
          >
            ↺ Restart
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">Interact with your actual chatbot flow below. Type messages or click the quick-reply buttons.</p>
      </CardHeader>
      <CardContent className="p-0">
        <div style={{
          display: "flex", flexDirection: "column",
          borderTop: "1px solid #e5e7eb",
          borderRadius: "0 0 12px 12px",
          overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}>
          {/* Header strip */}
          <div style={{ background: accentColor, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: "white" }}><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
            </div>
            <div>
              <p style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{botName || "My Chatbot"}</p>
              <p style={{ color: "rgba(255,255,255,.7)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} /> Active
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: 8, background: "#f9fafb", minHeight: 220, maxHeight: 320 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.from === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "82%", padding: "8px 12px",
                  borderRadius: m.from === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  fontSize: 13, lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap",
                  background: m.from === "user" ? accentColor : "#ffffff",
                  color: m.from === "user" ? "white" : "#111827",
                  border: m.from === "user" ? "none" : "1px solid #e5e7eb",
                }}>
                  {m.text}
                </div>
                <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{m.time}</span>
              </div>
            ))}
            {typing && (
              <div style={{ display: "flex" }}>
                <div style={{ padding: "8px 12px", borderRadius: "16px 16px 16px 4px", background: "#fff", border: "1px solid #e5e7eb", display: "flex", gap: 4, alignItems: "center" }}>
                  {[0, 1, 2].map(d => <span key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: "#9ca3af", display: "inline-block", animation: `sfb2 1.2s ${d * 0.2}s infinite ease-in-out` }} />)}
                </div>
              </div>
            )}
          </div>

          {/* Quick replies */}
          {qrs.length > 0 && !typing && (
            <div style={{ padding: "8px 10px", background: "#f9fafb", borderTop: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
              {qrs.map(opt => (
                <button key={opt} onClick={() => send(opt)} style={{ width: "100%", padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${accentColor}`, background: "transparent", color: accentColor, fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = accentColor + "14")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "8px 10px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 6, alignItems: "flex-end", background: "#fff" }}>
            <textarea ref={inputRef} rows={1} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={typing ? "Bot is typing…" : "Type a message…"}
              disabled={typing}
              style={{ flex: 1, border: "1.5px solid #e5e7eb", borderRadius: 18, padding: "7px 12px", fontSize: 13, outline: "none", background: "#f9fafb", resize: "none", maxHeight: 72, lineHeight: 1.4, fontFamily: "inherit", opacity: typing ? 0.5 : 1 }}
            />
            <button onClick={() => send(input)} disabled={typing || !input.trim()}
              style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "50%", background: (!typing && input.trim()) ? accentColor : "#e5e7eb", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: "white" }}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            </button>
          </div>
          <style>{`@keyframes sfb2{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-4px);opacity:1}}`}</style>
        </div>
      </CardContent>
    </Card>
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
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="training"  className="flex items-center gap-1.5"><Brain      className="w-3.5 h-3.5" />Training</TabsTrigger>
          <TabsTrigger value="faqs"      className="flex items-center gap-1.5"><HelpCircle className="w-3.5 h-3.5" />FAQs</TabsTrigger>
          <TabsTrigger value="offers"    className="flex items-center gap-1.5"><Tag         className="w-3.5 h-3.5" />Offers</TabsTrigger>
          <TabsTrigger value="vehicles"  className="flex items-center gap-1.5"><Truck       className="w-3.5 h-3.5" />Vehicles</TabsTrigger>
          <TabsTrigger value="hours"     className="flex items-center gap-1.5"><Clock       className="w-3.5 h-3.5" />Hours</TabsTrigger>
          <TabsTrigger value="flow"      className="flex items-center gap-1.5"><Workflow    className="w-3.5 h-3.5" />Flow</TabsTrigger>
        </TabsList>
        <TabsContent value="training"  className="mt-6"><TrainingTab config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="faqs"      className="mt-6"><FAQTab      config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="offers"    className="mt-6"><OffersTab   config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="vehicles"  className="mt-6"><VehiclesTab config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="hours"     className="mt-6"><HoursTab    config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="flow"      className="mt-6"><FlowTab     config={data} refetch={refetch} /></TabsContent>
      </Tabs>
    </div>
  );
}
