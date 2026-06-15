"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  HelpCircle, Tag, Truck, Clock, Plus, Trash2, Save,
  Pencil, Check, X, Bot, MessageSquare,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface FAQ      { _id?: string; question: string; answer: string;   isActive: boolean }
interface Offer    { _id?: string; title: string; description: string; validUntil?: string; isActive: boolean }
interface Vehicle  { _id?: string; name: string; category: string; payload: string; priceRange: string; description: string; isActive: boolean }
interface BizHour  { day: string; open: string; close: string; isClosed: boolean }
interface Config   { faqs: FAQ[]; offers: Offer[]; vehicles: Vehicle[]; businessHours: BizHour[]; welcomeMessage: string; agentOnlineMessage: string; agentOfflineMessage: string }

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
    (u[i] as Record<string, string | boolean>)[field] = val;
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
          <p className="text-sm text-gray-500">Manage FAQs, offers, vehicles, and business hours</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "FAQs",      value: data.faqs.length,        icon: HelpCircle, color: "bg-blue-50 text-blue-600" },
          { label: "Offers",    value: data.offers.length,      icon: Tag,        color: "bg-green-50 text-green-600" },
          { label: "Vehicles",  value: data.vehicles.length,    icon: Truck,      color: "bg-orange-50 text-orange-600" },
          { label: "Open Days", value: data.businessHours.filter(h => !h.isClosed).length, icon: Clock, color: "bg-purple-50 text-purple-600" },
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

      <Tabs defaultValue="faqs">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="faqs"     className="flex items-center gap-1.5"><HelpCircle className="w-3.5 h-3.5" />FAQs</TabsTrigger>
          <TabsTrigger value="offers"   className="flex items-center gap-1.5"><Tag        className="w-3.5 h-3.5" />Offers</TabsTrigger>
          <TabsTrigger value="vehicles" className="flex items-center gap-1.5"><Truck      className="w-3.5 h-3.5" />Vehicles</TabsTrigger>
          <TabsTrigger value="hours"    className="flex items-center gap-1.5"><Clock      className="w-3.5 h-3.5" />Hours</TabsTrigger>
        </TabsList>
        <TabsContent value="faqs"     className="mt-6"><FAQTab      config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="offers"   className="mt-6"><OffersTab   config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="vehicles" className="mt-6"><VehiclesTab config={data} refetch={refetch} /></TabsContent>
        <TabsContent value="hours"    className="mt-6"><HoursTab    config={data} refetch={refetch} /></TabsContent>
      </Tabs>
    </div>
  );
}
