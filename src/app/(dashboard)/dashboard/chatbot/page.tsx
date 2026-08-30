"use client";
import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  HelpCircle, Tag, Truck, Clock, Plus, Trash2, Save, Loader2,
  Pencil, Check, X, Bot, MessageSquare, Brain, Code, Sparkles,
  Zap, ExternalLink, CheckCircle2, Circle, Copy, Reply, Palette,
  GitBranch, ChevronDown, ChevronRight, ChevronUp, Ticket, UserCheck, ArrowRight, RotateCcw, Eye,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface FAQ      { _id?: string; question: string; answer: string; isActive: boolean }
interface Offer    { _id?: string; title: string; description: string; validUntil?: string; isActive: boolean }
interface Vehicle  { _id?: string; name: string; category: string; payload: string; priceRange: string; description: string; isActive: boolean }
interface BizHour  { day: string; open: string; close: string; isClosed: boolean }
interface Training { _id?: string; trigger: string; keywords: string[]; response: string; isActive: boolean }
interface CustomFlowStep { question: string; type: "choice" | "text"; options: string[]; saveAs: string }
interface CustomFlowItem {
  key: string; label: string; steps: CustomFlowStep[];
  outcome: "NONE" | "CREATE_LEAD" | "CREATE_TICKET" | "ASSIGN_AGENT";
  closingMessage: string; leadType?: string; leadScore?: number; ticketSubject?: string;
}
interface CustomFlow { enabled: boolean; menuIntro: string; flows: CustomFlowItem[] }
interface Config   {
  faqs: FAQ[]; offers: Offer[]; vehicles: Vehicle[];
  businessHours: BizHour[]; training: Training[]; customFlow?: CustomFlow;
  welcomeMessage: string; agentOnlineMessage: string; agentOfflineMessage: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  LCV: "bg-blue-100 text-blue-700",
  ICV: "bg-purple-100 text-purple-700",
  HCV: "bg-orange-100 text-orange-700",
  Bus: "bg-green-100 text-green-700",
  EV:  "bg-emerald-100 text-emerald-700",
};

async function patchConfig(body: Partial<Config>): Promise<{ success: true; data: Config } | { success: false; error: string }> {
  const res = await fetch("/api/chatbot-config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d?.success === false) return { success: false, error: d?.error || "Failed to save" };
  return { success: true, data: d.data };
}

// ── Step banner ────────────────────────────────────────────────────────────────
function StepBanner({ n, of, title, children }: { n: number; of: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-xs text-indigo-800 flex items-start gap-2.5">
      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">{n}</span>
      <div>
        <p className="font-semibold text-indigo-900">Step {n} of {of} — {title}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}

// ── FAQ Tab ────────────────────────────────────────────────────────────────────
function FAQTab({ config, refetch, showStepBanner = true }: { config: Config; refetch: () => void; showStepBanner?: boolean }) {
  const [faqs, setFaqs] = useState<FAQ[]>(config.faqs);
  const [newQ, setNewQ] = useState(""); const [newA, setNewA] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(updated: FAQ[]) {
    setSaving(true);
    const r = await patchConfig({ faqs: updated });
    setSaving(false);
    if (r.success) { setFaqs(r.data.faqs); refetch(); toast({ title: "FAQs saved" }); }
    else toast({ title: r.error, variant: "destructive" });
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
      {showStepBanner && (
        <StepBanner n={3} of={7} title="FAQs">
          Add common questions and answers. When a visitor&apos;s message matches an active FAQ, the bot answers with it directly — before falling back to the menu flow.
        </StepBanner>
      )}
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
          <FAQRow key={faq._id ?? i} faq={faq} onToggle={() => toggle(i)} onDelete={() => remove(i)} onSave={(q, a) => saveEdit(i, q, a)} isEditing={editIdx === i} onEdit={() => setEditIdx(i)} onCancel={() => setEditIdx(null)} />
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
              <button onClick={onEdit} aria-label={`Edit "${faq.question}"`} className="p-1 text-gray-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button aria-label={`Delete "${faq.question}"`} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this FAQ?</AlertDialogTitle>
                    <AlertDialogDescription>&quot;{faq.question}&quot; will no longer be answered by the bot. This can&apos;t be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Training Tab ───────────────────────────────────────────────────────────────
function TrainingTab({ config, refetch, showStepBanner = true }: { config: Config; refetch: () => void; showStepBanner?: boolean }) {
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
    if (r.success) { setEntries(r.data.training); refetch(); toast({ title: "Training saved" }); }
    else toast({ title: r.error, variant: "destructive" });
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
      {showStepBanner && (
        <StepBanner n={4} of={7} title="Training rules">
          Keyword → response rules. If a visitor&apos;s message contains any keyword in an active rule, the bot replies with that rule&apos;s response. Checked after FAQs, before the menu flow.
        </StepBanner>
      )}
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button aria-label={`Delete rule${e.trigger ? ` "${e.trigger}"` : ""}`} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this training rule?</AlertDialogTitle>
                        <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => save(entries.filter((_, idx) => idx !== i))}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Catalog Tab (Offers + Vehicles) ─────────────────────────────────────────────
function CatalogTab({ config, refetch, showStepBanner = true }: { config: Config; refetch: () => void; showStepBanner?: boolean }) {
  const [offers, setOffers] = useState<Offer[]>(config.offers);
  const [offerForm, setOfferForm] = useState({ title: "", description: "", validUntil: "" });
  const [vehicles, setVehicles] = useState<Vehicle[]>(config.vehicles);
  const [vehicleForm, setVehicleForm] = useState({ name: "", category: "LCV", payload: "", priceRange: "", description: "" });
  const [saving, setSaving] = useState(false);

  async function saveOffers(updated: Offer[]) {
    setSaving(true);
    const r = await patchConfig({ offers: updated });
    setSaving(false);
    if (r.success) { setOffers(r.data.offers); refetch(); toast({ title: "Offers saved" }); }
    else toast({ title: r.error, variant: "destructive" });
  }

  async function saveVehicles(updated: Vehicle[]) {
    setSaving(true);
    const r = await patchConfig({ vehicles: updated });
    setSaving(false);
    if (r.success) { setVehicles(r.data.vehicles); refetch(); toast({ title: "Vehicles saved" }); }
    else toast({ title: r.error, variant: "destructive" });
  }

  return (
    <div className="space-y-8">
      {showStepBanner && (
        <StepBanner n={5} of={7} title="Catalog">
          Offers and vehicles are reference data your team can keep up to date here. They&apos;re shown to visitors through the Offers and Find a Vehicle menu options.
        </StepBanner>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Tag className="w-4 h-4" />Offers</h3>
        <Card>
          <CardHeader><CardTitle className="text-sm">Add New Offer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Offer title (e.g. Fleet Discount)" value={offerForm.title} onChange={e => setOfferForm({ ...offerForm, title: e.target.value })} />
            <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-20 resize-none" placeholder="Description" value={offerForm.description} onChange={e => setOfferForm({ ...offerForm, description: e.target.value })} />
            <Input placeholder="Valid Until (e.g. 31 Dec 2025)" value={offerForm.validUntil} onChange={e => setOfferForm({ ...offerForm, validUntil: e.target.value })} />
            <Button onClick={() => { if (!offerForm.title || !offerForm.description) return; saveOffers([...offers, { ...offerForm, isActive: true }]); setOfferForm({ title: "", description: "", validUntil: "" }); }} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" /> Add Offer
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          {offers.map((o, i) => (
            <Card key={o._id ?? i} className={`border-l-4 ${o.isActive ? "border-l-green-400" : "border-l-gray-200"}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{o.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{o.description}</p>
                    {o.validUntil && <p className="text-xs text-orange-500 mt-1">Valid till: {o.validUntil}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={o.isActive} onCheckedChange={() => { const u = [...offers]; u[i].isActive = !u[i].isActive; saveOffers(u); }} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button aria-label={`Delete "${o.title}"`} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this offer?</AlertDialogTitle>
                          <AlertDialogDescription>&quot;{o.title}&quot; will no longer be shown to visitors. This can&apos;t be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => saveOffers(offers.filter((_, idx) => idx !== i))}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {offers.length === 0 && <p className="col-span-2 text-sm text-gray-400 text-center py-8">No offers yet.</p>}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Truck className="w-4 h-4" />Vehicles</h3>
        <Card>
          <CardHeader><CardTitle className="text-sm">Add Vehicle</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Input placeholder="Vehicle Name (e.g. Dost+)" value={vehicleForm.name} onChange={e => setVehicleForm({ ...vehicleForm, name: e.target.value })} />
            <select className="border rounded-md px-3 py-2 text-sm" value={vehicleForm.category} onChange={e => setVehicleForm({ ...vehicleForm, category: e.target.value })}>
              {["LCV", "ICV", "HCV", "Bus", "EV"].map(c => <option key={c}>{c}</option>)}
            </select>
            <Input placeholder="Payload (e.g. 1.5T)" value={vehicleForm.payload} onChange={e => setVehicleForm({ ...vehicleForm, payload: e.target.value })} />
            <Input placeholder="Price Range (e.g. ₹7-9L)" value={vehicleForm.priceRange} onChange={e => setVehicleForm({ ...vehicleForm, priceRange: e.target.value })} />
            <Input className="col-span-2" placeholder="Description" value={vehicleForm.description} onChange={e => setVehicleForm({ ...vehicleForm, description: e.target.value })} />
            <Button className="col-span-2 bg-indigo-600 hover:bg-indigo-700" disabled={saving} onClick={() => { if (!vehicleForm.name) return; saveVehicles([...vehicles, { ...vehicleForm, isActive: true }]); setVehicleForm({ name: "", category: "LCV", payload: "", priceRange: "", description: "" }); }}>
              <Plus className="w-4 h-4 mr-2" /> Add Vehicle
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v, i) => (
            <Card key={v._id ?? i} className={`border overflow-hidden ${!v.isActive ? "opacity-50" : ""}`}>
              <div className={`h-1 w-full ${v.isActive ? "bg-indigo-400" : "bg-gray-200"}`} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{v.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[v.category] || "bg-gray-100 text-gray-600"}`}>{v.category}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={v.isActive} onCheckedChange={() => { const u = [...vehicles]; u[i].isActive = !u[i].isActive; saveVehicles(u); }} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button aria-label={`Delete ${v.name}`} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {v.name}?</AlertDialogTitle>
                          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => saveVehicles(vehicles.filter((_, idx) => idx !== i))}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
    </div>
  );
}

// ── Business Hours Tab ─────────────────────────────────────────────────────────
function HoursTab({ config, refetch }: { config: Config; refetch: () => void }) {
  const [hours, setHours] = useState<BizHour[]>(config.businessHours);
  const [messages, setMessages] = useState({ online: config.agentOnlineMessage, offline: config.agentOfflineMessage });
  const [saving, setSaving] = useState(false);

  async function saveHours() {
    setSaving(true);
    const r = await patchConfig({ businessHours: hours, agentOnlineMessage: messages.online, agentOfflineMessage: messages.offline });
    setSaving(false);
    if (r.success) { refetch(); toast({ title: "Settings saved" }); }
    else toast({ title: r.error, variant: "destructive" });
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
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4" />Agent Handoff Messages</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-800">
            Not yet used by the live bot — saved here for a future handoff-messaging feature. The message visitors actually see first is set in the <strong>Welcome Message</strong> tab.
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
        <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save Business Hours"}
      </Button>
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
    const res = await fetch(`/api/canned-responses?id=${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d?.success === false) {
      toast({ title: d?.error || "Failed to delete", variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["canned-responses"] });
    toast({ title: "Deleted" });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-xs text-indigo-800">
        These are quick replies for your <strong>human agents</strong> in the Live Inbox — not part of the automated bot flow. Type <code className="bg-white/70 px-1 rounded">/shortcut</code> while replying to a conversation to insert one instantly.
      </div>
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
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button aria-label={`Delete "${item.title}"`} className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete &quot;{item.title}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => item._id && remove(item._id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Live Chat Setup Tab (Pusher) ────────────────────────────────────────────────
function RealtimeTab() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const steps = [
    { title: "Create a free Pusher account", desc: "Go to pusher.com, sign up for free. The free plan gives you 200 concurrent connections and 200,000 messages per day — enough for most businesses.", action: { label: "Open Pusher.com", href: "https://pusher.com" } },
    { title: "Create a new Channels app", desc: 'In the Pusher dashboard, click "Create app". Choose any name (e.g. "SupportFlow"), select your nearest cluster (e.g. ap2 for Asia Pacific), and click Create.', action: null },
    { title: "Copy your App Keys", desc: "Go to App Keys tab in your new Pusher app. You will see: App ID, Key, Secret, and Cluster. Copy all four.", action: null },
    { title: "Add keys to your .env.local file", desc: "Open your .env.local file and fill in the four Pusher values below. Then restart your server.", action: null },
    { title: "Restart the server", desc: "Stop and restart your Next.js server (npm run dev or your production process manager). The widget will automatically pick up Pusher — no changes to your embed snippet needed.", action: null },
  ];

  const envBlock = `PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=ap2`;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-xs text-indigo-800">
        Optional — this makes agent replies arrive instantly in the widget instead of every 5 seconds. Not required for the bot flow itself.
      </div>
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
            </div>
          </div>
        </CardContent>
      </Card>

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
                    <a href={step.action.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
                      {step.action.label} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
    </div>
  );
}

// ── Flow reference (mirrors chatbot-flow.ts MAIN_MENU) ──────────────────────────
const FLOWS = [
  { key: "find_vehicle", label: "🚛 Find a Vehicle", color: "#6366f1", bg: "#ede9fe", steps: [
      { q: "Vehicle type?", opts: ["Light CV", "Intermediate CV", "Heavy Duty", "Bus", "Electric"] },
      { q: "Usage purpose?", opts: ["Logistics", "Cargo", "Construction", "Agriculture", "E-commerce"] },
      { q: "Payload required?", opts: ["Under 2T", "2-5T", "5-10T", "10-20T", "Above 20T"] },
      { q: "Fuel preference?", opts: ["Diesel", "CNG", "Electric", "Not Sure"] },
      { q: "🚛 AI recommendation shown", opts: [] },
    ], outcome: "CREATE_LEAD" },
  { key: "on_road_price", label: "💰 Get On-Road Price", color: "#f59e0b", bg: "#fef3c7", steps: [
      { q: "Select vehicle?", opts: ["Dost+", "Ecomet 912", "AVTR 4940", "Circuit S"] },
      { q: "Select variant?", opts: ["Base", "Standard", "Plus", "Premium"] },
      { q: "Your city?", opts: ["Mumbai", "Delhi", "Chennai", "Bangalore"] },
      { q: "💰 Estimated price shown", opts: [] },
    ], outcome: "NONE" },
  { key: "brochure", label: "📄 Download Brochure", color: "#0ea5e9", bg: "#e0f2fe", steps: [
      { q: "Select vehicle?", opts: ["Dost+", "Ecomet 912", "AVTR 4940", "Circuit S"] },
      { q: "Your name?", opts: [], input: true },
      { q: "Mobile number?", opts: [], input: true },
      { q: "Email address?", opts: [], input: true },
      { q: "Your city?", opts: ["Mumbai", "Delhi", "Chennai", "Hyderabad"] },
    ], outcome: "CREATE_LEAD" },
  { key: "test_drive", label: "🚗 Book Test Drive", color: "#22c55e", bg: "#dcfce7", steps: [
      { q: "Select vehicle?", opts: ["Dost+", "Ecomet 912", "AVTR 4940", "Other"] },
      { q: "Dealer city?", opts: ["Mumbai", "Delhi", "Chennai", "Hyderabad"] },
      { q: "Preferred date?", opts: ["Today", "Tomorrow", "This Saturday", "This Sunday"] },
      { q: "Time slot?", opts: ["9–11 AM", "11–1 PM", "2–4 PM", "4–6 PM"] },
      { q: "Your name?", opts: [], input: true },
      { q: "Mobile number?", opts: [], input: true },
    ], outcome: "CREATE_LEAD" },
  { key: "service", label: "🛠️ Service & Support", color: "#8b5cf6", bg: "#ede9fe", steps: [
      { q: "Service type?", opts: ["Book Service", "AMC Plans", "Breakdown", "Status"] },
      { q: "Vehicle number?", opts: [], input: true },
      { q: "Dealer city?", opts: ["Mumbai", "Delhi", "Chennai", "Hyderabad"] },
      { q: "Preferred date?", opts: ["Today", "Tomorrow", "This Saturday"] },
    ], outcome: "CREATE_TICKET" },
  { key: "spare_parts", label: "🔧 Spare Parts", color: "#ec4899", bg: "#fce7f3", steps: [
      { q: "Select vehicle?", opts: ["Dost+", "Ecomet 912", "AVTR 4940", "Circuit S"] },
      { q: "Part category?", opts: ["Engine", "Battery", "Brakes", "Suspension", "Filters"] },
      { q: "Your name?", opts: [], input: true },
      { q: "Mobile number?", opts: [], input: true },
    ], outcome: "CREATE_LEAD" },
  { key: "finance", label: "💳 Finance & EMI", color: "#f97316", bg: "#ffedd5", steps: [
      { q: "Select vehicle?", opts: ["Dost+", "Ecomet 912", "AVTR 4940"] },
      { q: "Vehicle price? (₹L)", opts: [], input: true },
      { q: "Down payment? (₹L)", opts: [], input: true },
      { q: "Loan tenure?", opts: ["12 Months", "24 Months", "36 Months", "48 Months", "60 Months"] },
      { q: "💳 EMI calculation shown", opts: [] },
    ], outcome: "NONE" },
  { key: "find_dealer", label: "📍 Find Dealer", color: "#14b8a6", bg: "#f0fdfa", steps: [
      { q: "Your city?", opts: ["Mumbai", "Delhi", "Chennai", "Bangalore", "Hyderabad"] },
      { q: "📍 Dealer info shown", opts: [] },
    ], outcome: "NONE" },
  { key: "callback", label: "📞 Request Callback", color: "#64748b", bg: "#f1f5f9", steps: [
      { q: "Your name?", opts: [], input: true },
      { q: "Mobile number?", opts: [], input: true },
      { q: "Preferred time?", opts: ["9–11 AM", "11–1 PM", "2–4 PM", "4–6 PM", "Anytime"] },
    ], outcome: "CREATE_LEAD" },
  { key: "agent", label: "💬 Chat with Agent", color: "#6366f1", bg: "#ede9fe", steps: [
      { q: "Query category?", opts: ["New Purchase", "Pricing", "Finance", "Fleet", "Service"] },
      { q: "Your name?", opts: [], input: true },
      { q: "Mobile number?", opts: [], input: true },
      { q: "Email address?", opts: [], input: true },
      { q: "Your city?", opts: ["Mumbai", "Delhi", "Chennai", "Hyderabad"] },
    ], outcome: "ASSIGN_AGENT" },
];

const OUTCOME_LABELS: Record<string, { label: string; color: string; icon: typeof Tag }> = {
  CREATE_LEAD:   { label: "Lead Created",   color: "text-green-700 bg-green-100 border-green-200",   icon: Tag },
  CREATE_TICKET: { label: "Ticket Created", color: "text-orange-700 bg-orange-100 border-orange-200", icon: Ticket },
  ASSIGN_AGENT:  { label: "Agent Assigned", color: "text-indigo-700 bg-indigo-100 border-indigo-200", icon: UserCheck },
  NONE:          { label: "Back to Menu",   color: "text-gray-600 bg-gray-100 border-gray-200",      icon: ArrowRight },
};

function slugifyKey(s: string): string {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${base || "option"}_${Date.now().toString(36)}`;
}

// Read-only reference for the built-in demo menu — shown when a company hasn't
// turned on their own custom menu yet, so they can see what visitors get by default.
function DefaultFlowReference({ expandedFlow, setExpandedFlow }: { expandedFlow: string | null; setExpandedFlow: (v: string | null) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {FLOWS.map((flow) => {
        const isOpen = expandedFlow === flow.key;
        const outcome = OUTCOME_LABELS[flow.outcome];
        const OutcomeIcon = outcome.icon;
        return (
          <div key={flow.key} className="rounded-2xl border overflow-hidden shadow-sm transition-shadow hover:shadow-md" style={{ borderColor: flow.color + "44" }}>
            <button onClick={() => setExpandedFlow(isOpen ? null : flow.key)} className="w-full flex items-center justify-between p-3 text-left transition-colors" style={{ backgroundColor: flow.bg }}>
              <span className="font-semibold text-sm" style={{ color: flow.color }}>{flow.label}</span>
              {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: flow.color }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: flow.color }} />}
            </button>
            {isOpen && (
              <div className="bg-white p-3 space-y-2 border-t" style={{ borderColor: flow.color + "22" }}>
                {flow.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: flow.color }}>{i + 1}</div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-700">{step.q}</p>
                      {step.opts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {step.opts.map((o) => <span key={o} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{o}</span>)}
                        </div>
                      )}
                      {step.input && <span className="text-[10px] text-gray-400 italic">✏️ Free text input</span>}
                    </div>
                  </div>
                ))}
                <div className={`flex items-center gap-1.5 mt-2 pt-2 border-t text-xs font-semibold px-2 py-1 rounded-lg ${outcome.color} border`}>
                  <OutcomeIcon className="w-3.5 h-3.5" />
                  {outcome.label}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Menu Flow Builder Tab ───────────────────────────────────────────────────────
function FlowBuilderTab({ config, refetch, showStepBanner = true }: { config: Config; refetch: () => void; showStepBanner?: boolean }) {
  const seed: CustomFlow = config.customFlow ?? { enabled: false, menuIntro: "How can we help you today? Please select an option:", flows: [] };
  const [enabled, setEnabled] = useState(seed.enabled);
  const [menuIntro, setMenuIntro] = useState(seed.menuIntro);
  const [flows, setFlows] = useState<CustomFlowItem[]>(seed.flows);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(patch: Partial<{ enabled: boolean; menuIntro: string; flows: CustomFlowItem[] }> = {}) {
    const payload = { enabled: patch.enabled ?? enabled, menuIntro: patch.menuIntro ?? menuIntro, flows: patch.flows ?? flows };
    setSaving(true);
    const r = await patchConfig({ customFlow: payload });
    setSaving(false);
    if (r.success) {
      const cf = r.data.customFlow ?? payload;
      setEnabled(cf.enabled); setMenuIntro(cf.menuIntro); setFlows(cf.flows);
      refetch();
      toast({ title: "Menu flow saved" });
    } else toast({ title: r.error, variant: "destructive" });
  }

  function addFlow() {
    const item: CustomFlowItem = { key: slugifyKey("option"), label: "New Option", steps: [], outcome: "NONE", closingMessage: "", leadType: "", leadScore: 60, ticketSubject: "" };
    const next = [...flows, item];
    setFlows(next);
    setOpenIdx(next.length - 1);
  }

  function updateFlow(i: number, patch: Partial<CustomFlowItem>) {
    setFlows((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeFlow(i: number) {
    const next = flows.filter((_, idx) => idx !== i);
    setFlows(next);
    if (openIdx === i) setOpenIdx(null);
    save({ flows: next });
  }

  function addStep(i: number) {
    updateFlow(i, { steps: [...flows[i].steps, { question: "", type: "choice", options: [], saveAs: "" }] });
  }
  function updateStep(i: number, si: number, patch: Partial<CustomFlowStep>) {
    updateFlow(i, { steps: flows[i].steps.map((st, idx) => (idx === si ? { ...st, ...patch } : st)) });
  }
  function removeStep(i: number, si: number) {
    updateFlow(i, { steps: flows[i].steps.filter((_, idx) => idx !== si) });
  }
  function moveStep(i: number, si: number, dir: -1 | 1) {
    const steps = [...flows[i].steps];
    const target = si + dir;
    if (target < 0 || target >= steps.length) return;
    [steps[si], steps[target]] = [steps[target], steps[si]];
    updateFlow(i, { steps });
  }

  return (
    <div className="space-y-4">
      {showStepBanner && (
        <StepBanner n={2} of={7} title="Menu flow">
          Build your own bot menu to replace the built-in demo below. Each option can ask a series of questions, then create a Lead, a Ticket, or hand off to an agent — this is what runs for every company that turns it on.
        </StepBanner>
      )}

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Use a custom menu</p>
            <p className="text-xs text-gray-400 mt-0.5">When off, visitors see the built-in demo menu (Find a Vehicle, Get On-Road Price, …) shown below for reference.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={(v) => { setEnabled(v); save({ enabled: v }); }} />
        </CardContent>
      </Card>

      {!enabled ? (
        <DefaultFlowReference expandedFlow={expandedFlow} setExpandedFlow={setExpandedFlow} />
      ) : (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <label className="text-sm font-medium">Menu intro text</label>
              <p className="text-xs text-gray-400">Shown above the menu buttons, right after the welcome message.</p>
              <Input value={menuIntro} onChange={(e) => setMenuIntro(e.target.value)} />
            </CardContent>
          </Card>

          <div className="space-y-2">
            {flows.length === 0 && (
              <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">
                <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No menu options yet.</p>
                <p className="text-xs mt-1">Add your first option below — this becomes a button visitors can tap.</p>
              </div>
            )}
            {flows.map((f, i) => {
              const isOpen = openIdx === i;
              return (
                <Card key={f.key} className="overflow-hidden">
                  <button onClick={() => setOpenIdx(isOpen ? null : i)} className="w-full flex items-center justify-between p-3.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      {f.label || "Untitled option"}
                      <span className="text-xs font-normal text-gray-400">{f.steps.length} step{f.steps.length === 1 ? "" : "s"}</span>
                    </span>
                    {isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />}
                  </button>
                  {isOpen && (
                    <CardContent className="p-4 space-y-4 border-t">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Menu button label</label>
                        <Input value={f.label} onChange={(e) => updateFlow(i, { label: e.target.value })} placeholder="e.g. 🏠 Book a Viewing" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600 block">Questions ({f.steps.length})</label>
                        {f.steps.map((st, si) => (
                          <div key={si} className="border rounded-lg p-3 bg-gray-50/60">
                            <div className="flex items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-1.5">{si + 1}</span>
                              <div className="flex-1 space-y-2">
                                <Input placeholder="Question text (e.g. Which city are you in?)" value={st.question} onChange={(e) => updateStep(i, si, { question: e.target.value })} />
                                <div className="flex items-center gap-2">
                                  <select className="border rounded-md px-2 py-1.5 text-xs bg-white" value={st.type} onChange={(e) => updateStep(i, si, { type: e.target.value as "choice" | "text" })}>
                                    <option value="choice">Multiple choice</option>
                                    <option value="text">Free text</option>
                                  </select>
                                  <Input className="text-xs flex-1" placeholder="Save answer as… (e.g. city)" value={st.saveAs} onChange={(e) => updateStep(i, si, { saveAs: e.target.value.replace(/\s+/g, "_") })} />
                                </div>
                                {st.type === "choice" && (
                                  <Input className="text-xs" placeholder="Options, comma separated (e.g. Mumbai, Delhi, Chennai)" value={st.options.join(", ")} onChange={(e) => updateStep(i, si, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })} />
                                )}
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                <button onClick={() => moveStep(i, si, -1)} disabled={si === 0} aria-label="Move question up" className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400"><ChevronUp className="w-3.5 h-3.5" /></button>
                                <button onClick={() => moveStep(i, si, 1)} disabled={si === f.steps.length - 1} aria-label="Move question down" className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:hover:text-gray-400"><ChevronDown className="w-3.5 h-3.5" /></button>
                                <button onClick={() => removeStep(i, si)} aria-label="Remove question" className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => addStep(i)}><Plus className="w-3.5 h-3.5 mr-1.5" />Add Question</Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 items-end">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">When finished</label>
                          <select className="w-full border rounded-md px-2 py-2 text-sm bg-white" value={f.outcome} onChange={(e) => updateFlow(i, { outcome: e.target.value as CustomFlowItem["outcome"] })}>
                            <option value="NONE">Just show the closing message</option>
                            <option value="CREATE_LEAD">Create a Lead</option>
                            <option value="CREATE_TICKET">Create a Ticket</option>
                            <option value="ASSIGN_AGENT">Hand off to an agent</option>
                          </select>
                        </div>
                        {f.outcome === "CREATE_LEAD" && (
                          <div className="grid grid-cols-2 gap-2">
                            <Input placeholder="Lead type (e.g. INQUIRY)" value={f.leadType ?? ""} onChange={(e) => updateFlow(i, { leadType: e.target.value })} />
                            <Input type="number" min={0} max={100} placeholder="Score" value={f.leadScore ?? 60} onChange={(e) => updateFlow(i, { leadScore: Number(e.target.value) || 0 })} />
                          </div>
                        )}
                        {f.outcome === "CREATE_TICKET" && (
                          <Input placeholder="Ticket subject (e.g. Service request — {{vehicle}})" value={f.ticketSubject ?? ""} onChange={(e) => updateFlow(i, { ticketSubject: e.target.value })} />
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Closing message</label>
                        <p className="text-xs text-gray-400 mb-1">
                          Use <code className="bg-gray-100 px-1 rounded">{"{{fieldName}}"}</code> to insert an answer — e.g. <code className="bg-gray-100 px-1 rounded">{"{{city}}"}</code> inserts whatever was saved under &quot;city&quot; above.
                        </p>
                        <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-20 resize-none" placeholder="Thanks! We'll be in touch shortly." value={f.closingMessage} onChange={(e) => updateFlow(i, { closingMessage: e.target.value })} />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Delete this option</button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete &quot;{f.label}&quot;?</AlertDialogTitle>
                              <AlertDialogDescription>Visitors mid-conversation on this option will be sent back to the menu. This can&apos;t be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeFlow(i)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button size="sm" onClick={() => save()} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                          Save this option
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={addFlow}><Plus className="w-4 h-4 mr-2" />Add Menu Option</Button>
            <Button onClick={() => save()} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Menu
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ config, refetch }: { config: Config; refetch: () => void }) {
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm bg-linear-to-r from-indigo-50 to-purple-50">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">One chatbot per company</h3>
              <p className="text-sm text-gray-600 mt-1">Everything on this page — welcome message, FAQs, training rules, appearance and install code — configures the single bot your visitors talk to. There&apos;s nothing else to set up elsewhere.</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                {[
                  { icon: "1️⃣", text: "Visitor opens the widget on your website" },
                  { icon: "2️⃣", text: "Bot checks your FAQs and Training rules first" },
                  { icon: "3️⃣", text: "No match → bot follows the menu flow below" },
                  { icon: "4️⃣", text: "Certain steps create a Lead, a Ticket, or hand off to an agent" },
                ].map((step) => (
                  <div key={step.icon} className="flex items-start gap-2">
                    <span className="text-lg">{step.icon}</span>
                    <p className="text-xs text-gray-600">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "FAQs",      value: config.faqs.length,          icon: HelpCircle, color: "bg-blue-50 text-blue-600" },
          { label: "Training",  value: (config.training ?? []).length, icon: Brain,   color: "bg-indigo-50 text-indigo-600" },
          { label: "Offers",    value: config.offers.length,        icon: Tag,        color: "bg-green-50 text-green-600" },
          { label: "Vehicles",  value: config.vehicles.length,      icon: Truck,      color: "bg-orange-50 text-orange-600" },
          { label: "Open Days", value: config.businessHours.filter(h => !h.isClosed).length, icon: Clock, color: "bg-purple-50 text-purple-600" },
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

      <div>
        {config.customFlow?.enabled ? (
          <>
            <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><GitBranch className="w-4 h-4" />What the bot can do (your custom menu)</p>
            <div className="rounded-2xl border p-4 bg-white space-y-2">
              {config.customFlow.flows.length === 0 ? (
                <p className="text-sm text-gray-400">Custom menu is on but has no options yet — add some in the Menu Flow tab.</p>
              ) : config.customFlow.flows.map((f) => (
                <div key={f.key} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                  <span className="font-medium text-gray-700">{f.label}</span>
                  <span className="text-xs text-gray-400">{f.steps.length} step{f.steps.length === 1 ? "" : "s"} · {OUTCOME_LABELS[f.outcome].label}</span>
                </div>
              ))}
              <p className="text-xs text-gray-400 pt-2">Edit this in the <strong>Menu Flow</strong> tab.</p>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><GitBranch className="w-4 h-4" />What the bot can do (built-in demo menu)</p>
            <DefaultFlowReference expandedFlow={expandedFlow} setExpandedFlow={setExpandedFlow} />
            <p className="text-xs text-gray-400 text-center pt-3">Click any flow to see its steps · Want your own menu instead? Build one in the Menu Flow tab.</p>
          </>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Pencil className="w-4 h-4" />Manage everything from here</p>
        {[
          { key: "flow",     label: "Menu Flow", count: config.customFlow?.flows.length ?? 0, icon: GitBranch, render: () => <FlowBuilderTab config={config} refetch={refetch} showStepBanner={false} /> },
          { key: "faqs",     label: "FAQs",     count: config.faqs.length,             icon: HelpCircle, render: () => <FAQTab config={config} refetch={refetch} showStepBanner={false} /> },
          { key: "training", label: "Training", count: (config.training ?? []).length, icon: Brain,      render: () => <TrainingTab config={config} refetch={refetch} showStepBanner={false} /> },
          { key: "catalog",  label: "Catalog (Offers & Vehicles)", count: config.offers.length + config.vehicles.length, icon: Tag, render: () => <CatalogTab config={config} refetch={refetch} showStepBanner={false} /> },
        ].map((section) => {
          const isOpen = openSection === section.key;
          return (
            <div key={section.key} className="rounded-2xl border overflow-hidden shadow-sm">
              <button
                onClick={() => setOpenSection(isOpen ? null : section.key)}
                className="w-full flex items-center justify-between p-3.5 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="font-semibold text-sm text-gray-800 flex items-center gap-2">
                  <section.icon className="w-4 h-4 text-indigo-600" />
                  {section.label}
                  <span className="text-xs font-normal text-gray-400 bg-white border rounded-full px-2 py-0.5">{section.count}</span>
                </span>
                {isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />}
              </button>
              {isOpen && (
                <div className="bg-white p-4 border-t">
                  {section.render()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Live chatbot preview (hits the same endpoint the real widget uses) ─────────
type ChatMsg = { from: "bot" | "user"; text: string; time: string };

function ChatbotFlowPreview({ color, theme, companyName, logo }: { color: string; theme: string; companyName: string; logo?: string }) {
  const dark  = theme === "DARK";
  const BG    = dark ? "#1f2937" : "#ffffff";
  const BG2   = dark ? "#111827" : "#f9fafb";
  const BORD  = dark ? "#374151" : "#e5e7eb";
  const TXT   = dark ? "#f9fafb" : "#111827";
  const MUTED = dark ? "#9ca3af" : "#6b7280";

  const [msgs, setMsgs]     = useState<ChatMsg[]>([]);
  const [qrs, setQRs]       = useState<string[]>([]);
  const [sess, setSess]     = useState<Record<string, unknown>>({});
  const [input, setInput]   = useState("");
  const [typing, setTyping] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError]   = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const ts = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typing, qrs]);

  useEffect(() => {
    let cancelled = false;
    setMsgs([]); setQRs([]); setSess({}); setInput(""); setError(""); setTyping(true);

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
            await new Promise<void>((r) => setTimeout(r, 300));
            if (!cancelled) setMsgs((p) => [...p, { from: "bot", text, time: ts() }]);
          }
          if (!cancelled) {
            setQRs(data.data.quickReplies || []);
            setSess(data.data.sessionData || {});
          }
        } else {
          if (!cancelled) setError(data.error || "Could not load chatbot flow");
        }
      } catch {
        if (!cancelled) setError("Network error — make sure the dev server is running");
      }
      if (!cancelled) {
        setTyping(false);
        setTimeout(() => inputRef.current?.focus(), 120);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const send = async (msg: string) => {
    const text = msg.trim();
    if (!text || typing) return;
    const snapshot = sess;
    setMsgs((p) => [...p, { from: "user", text, time: ts() }]);
    setQRs([]);
    setInput("");
    setTyping(true);
    try {
      const res  = await fetch("/api/widget/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionData: snapshot }),
      });
      const data = await res.json();
      if (data.success) {
        for (const m of (data.data.messages as string[])) {
          await new Promise<void>((r) => setTimeout(r, 300));
          setMsgs((p) => [...p, { from: "bot", text: m, time: ts() }]);
        }
        setQRs(data.data.quickReplies || []);
        setSess(data.data.sessionData || {});
      } else {
        setMsgs((p) => [...p, { from: "bot", text: "⚠️ " + (data.error || "Error"), time: ts() }]);
      }
    } catch {
      setMsgs((p) => [...p, { from: "bot", text: "⚠️ Connection error. Please try again.", time: ts() }]);
    }
    setTyping(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      background: BG, borderRadius: "18px",
      boxShadow: "0 12px 48px rgba(0,0,0,.18)",
      border: `1px solid ${BORD}`, overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      minHeight: 500,
    }}>
      <div style={{ background: color, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, position: "relative" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {logo ? (
            <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: "white" }}>
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {companyName || "Your Company"}
          </div>
          <div style={{ color: "rgba(255,255,255,.78)", fontSize: 11.5, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
            Chatbot Active
          </div>
        </div>
        <button
          onClick={() => setResetKey((k) => k + 1)}
          title="Restart conversation"
          style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 6, color: "white", cursor: "pointer", padding: "5px 9px", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
          Restart
        </button>
      </div>

      {error && !typing && msgs.length === 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 12, background: BG2 }}>
          <div style={{ fontSize: 28 }}>⚠️</div>
          <p style={{ fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 1.6 }}>{error}</p>
          <button onClick={() => setResetKey((k) => k + 1)} style={{ padding: "9px 20px", background: color, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Try Again
          </button>
        </div>
      )}

      {(!error || msgs.length > 0) && (
        <div ref={scrollRef} style={{
          flex: 1, overflowY: "auto", padding: "14px 14px 8px",
          display: "flex", flexDirection: "column", gap: 10,
          background: BG2, minHeight: 240, maxHeight: 340,
        }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.from === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "84%", padding: "9px 13px",
                borderRadius: m.from === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                fontSize: 13, lineHeight: 1.55, wordBreak: "break-word", whiteSpace: "pre-wrap",
                background: m.from === "user" ? color : BG,
                color: m.from === "user" ? "white" : TXT,
                border: m.from === "user" ? "none" : `1px solid ${BORD}`,
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
              }}>
                {m.text}
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 3, paddingLeft: m.from === "bot" ? 3 : 0, paddingRight: m.from === "user" ? 3 : 0 }}>
                {m.time}
              </div>
            </div>
          ))}
          {typing && (
            <div style={{ display: "flex" }}>
              <div style={{ padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: BG, border: `1px solid ${BORD}`, display: "flex", gap: 4, alignItems: "center" }}>
                {[0, 1, 2].map((d) => (
                  <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: MUTED, display: "inline-block", animation: `sfb 1.2s ${d * 0.2}s infinite ease-in-out` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {qrs.length > 0 && !typing && (
        <div style={{ padding: "8px 12px 10px", background: BG2, borderTop: `1px solid ${BORD}`, display: "flex", flexDirection: "column", gap: 5, flexShrink: 0, maxHeight: 200, overflowY: "auto" }}>
          {qrs.map((opt) => (
            <button
              key={opt}
              onClick={() => send(opt)}
              style={{ width: "100%", padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${color}`, background: "transparent", color: color, fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left", lineHeight: 1.3 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = color + "14")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: "10px 12px", borderTop: `1px solid ${BORD}`, display: "flex", gap: 8, alignItems: "flex-end", background: BG, flexShrink: 0 }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder={typing ? "Bot is typing…" : "Type a message… (Enter to send)"}
          disabled={typing}
          style={{ flex: 1, border: `1.5px solid ${BORD}`, borderRadius: 22, padding: "9px 14px", fontSize: 13, outline: "none", background: BG2, color: TXT, resize: "none", maxHeight: 80, lineHeight: 1.4, fontFamily: "inherit", opacity: typing ? 0.55 : 1 }}
        />
        <button
          onClick={() => send(input)}
          disabled={typing || !input.trim()}
          style={{ width: 38, height: 38, flexShrink: 0, borderRadius: "50%", background: (!typing && input.trim()) ? color : BORD, border: "none", cursor: (!typing && input.trim()) ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}>
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: "white" }}>
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>

      <div style={{ textAlign: "center", fontSize: 10, color: MUTED, padding: "4px 0 6px" }}>
        Powered by <span style={{ color }}>SupportFlow</span>
      </div>

      <style>{`
        @keyframes sfb {
          0%,80%,100% { transform:translateY(0); opacity:.45; }
          40% { transform:translateY(-5px); opacity:1; }
        }
      `}</style>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
const VALID_TABS = ["overview", "welcome", "flow", "faqs", "training", "catalog", "hours", "appearance", "install", "canned", "realtime"];

function ChatbotPageInner() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const initialTab = VALID_TABS.includes(searchParams.get("tab") || "") ? (searchParams.get("tab") as string) : "overview";
  const [tab, setTab] = useState(initialTab);
  const [copied, setCopied] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string>("");
  const [settings, setSettings] = useState({
    theme: "LIGHT" as "LIGHT" | "DARK",
    primaryColor: "#6366f1",
    position: "BOTTOM_RIGHT" as "BOTTOM_RIGHT" | "BOTTOM_LEFT",
    welcomeMessage: "Hi! How can we help you today?",
    offlineMessage: "We're offline. Leave a message!",
    showAgentAvatar: true,
    showAgentName: true,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["chatbot-config"],
    queryFn: async () => {
      const r = await fetch("/api/chatbot-config");
      const d = await r.json();
      return d.data as Config;
    },
    staleTime: 30_000,
  });

  function refetchConfig() { qc.invalidateQueries({ queryKey: ["chatbot-config"] }); }

  const { data: apiKeys } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/api-keys");
      const d = await res.json();
      return d.data;
    },
  });

  const { data: companyData } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      const d = await res.json();
      return d.data;
    },
  });

  // companyData is the Settings document (no name/logo) — fetch the real Company
  // record for those, keyed off Settings.companyId.
  const { data: companyProfile } = useQuery({
    queryKey: ["company-profile", companyData?.companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyData.companyId}`);
      const d = await res.json();
      return d.data as { name?: string; logo?: string };
    },
    enabled: !!companyData?.companyId,
  });

  // Seed local widget-settings form once company data arrives (derived during
  // render, not an effect, so it applies before paint with no extra render pass)
  const [appliedWidget, setAppliedWidget] = useState<unknown>(undefined);
  if (companyData?.widget && companyData.widget !== appliedWidget) {
    setAppliedWidget(companyData.widget);
    setSettings((s) => ({ ...s, ...companyData.widget }));
  }

  const saveMutation = useMutation({
    mutationFn: async (data: typeof settings) => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widget: data }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d?.success === false) throw new Error(d?.error || "Failed to save widget settings");
      return d;
    },
    onSuccess: () => {
      toast({ title: "Widget settings saved" });
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    },
    onError: (err: unknown) => {
      toast({ title: err instanceof Error ? err.message : "Failed to save widget settings", variant: "destructive" });
    },
  });

  const activeKeys = (apiKeys || []).filter((k: { isActive: boolean }) => k.isActive);
  const selectedKey = activeKeys.find((k: { _id: string }) => k._id === selectedKeyId) || activeKeys[0];
  const widgetKey = selectedKey?.key || "YOUR_API_KEY";
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");

  const snippetCode = `<!-- SupportFlow Widget -->
<script>
  window.SupportFlowConfig = {
    apiKey: "${widgetKey}",
    baseUrl: "${appUrl}",
    theme: "${settings.theme.toLowerCase()}",
    position: "${settings.position.toLowerCase().replace("_", "-")}",
    primaryColor: "${settings.primaryColor}",
    welcomeMessage: "${settings.welcomeMessage}",
  };
</script>
<script src="${appUrl}/widget.js" async></script>`;

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippetCode);
      setCopied(true);
      toast({ title: "Code copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy — your browser blocked clipboard access", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
          <Bot className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Your Chatbot</h1>
          <p className="text-sm text-gray-500">Set up the welcome message, FAQs, training rules, appearance and install code — all in one place</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex flex-wrap gap-1 h-auto w-full justify-start bg-gray-100 p-1">
              <TabsTrigger value="overview"   className="text-xs"><Sparkles className="w-3.5 h-3.5 mr-1" />Overview</TabsTrigger>
              <TabsTrigger value="welcome"    className="text-xs"><MessageSquare className="w-3.5 h-3.5 mr-1" />Welcome Message</TabsTrigger>
              <TabsTrigger value="flow"       className="text-xs"><GitBranch className="w-3.5 h-3.5 mr-1" />Menu Flow</TabsTrigger>
              <TabsTrigger value="faqs"       className="text-xs"><HelpCircle className="w-3.5 h-3.5 mr-1" />FAQs</TabsTrigger>
              <TabsTrigger value="training"   className="text-xs"><Brain className="w-3.5 h-3.5 mr-1" />Training</TabsTrigger>
              <TabsTrigger value="catalog"    className="text-xs"><Tag className="w-3.5 h-3.5 mr-1" />Catalog</TabsTrigger>
              <TabsTrigger value="appearance" className="text-xs"><Palette className="w-3.5 h-3.5 mr-1" />Appearance</TabsTrigger>
              <TabsTrigger value="install"    className="text-xs"><Code className="w-3.5 h-3.5 mr-1" />Install Code</TabsTrigger>
              <TabsTrigger value="hours"      className="text-xs"><Clock className="w-3.5 h-3.5 mr-1" />Hours</TabsTrigger>
              <TabsTrigger value="canned"     className="text-xs"><Reply className="w-3.5 h-3.5 mr-1" />Canned</TabsTrigger>
              <TabsTrigger value="realtime"   className="text-xs"><Zap className="w-3.5 h-3.5 mr-1" />Live Chat Setup</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="mt-4">
              {configLoading || !config ? (
                <div className="space-y-4"><div className="h-8 w-64 bg-gray-200 rounded animate-pulse" /><div className="h-48 bg-gray-100 rounded-xl animate-pulse" /></div>
              ) : <OverviewTab config={config} refetch={refetchConfig} />}
            </TabsContent>

            {/* Welcome Message */}
            <TabsContent value="welcome" className="space-y-4 mt-4">
              <StepBanner n={1} of={7} title="Welcome message">
                This is the very first thing visitors see when they open the chat widget. This is the single, real source of truth for the greeting — it&apos;s what all other pages point to.
              </StepBanner>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium">Welcome Message</label>
                    <p className="text-xs text-gray-400 mt-0.5 mb-1">Shown as the first message when chat opens</p>
                    <Input value={settings.welcomeMessage} onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Offline Message</label>
                    <p className="text-xs text-gray-400 mt-0.5 mb-1">Shown when no agents are available</p>
                    <Input value={settings.offlineMessage} onChange={(e) => setSettings({ ...settings, offlineMessage: e.target.value })} className="mt-1" />
                  </div>
                </CardContent>
              </Card>
              <Button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Welcome Message
              </Button>
            </TabsContent>

            {/* FAQs */}
            <TabsContent value="flow" className="mt-4">
              {configLoading || !config ? (
                <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
              ) : <FlowBuilderTab config={config} refetch={refetchConfig} />}
            </TabsContent>

            <TabsContent value="faqs" className="mt-4">
              {configLoading || !config ? (
                <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
              ) : <FAQTab config={config} refetch={refetchConfig} />}
            </TabsContent>

            {/* Training */}
            <TabsContent value="training" className="mt-4">
              {configLoading || !config ? (
                <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
              ) : <TrainingTab config={config} refetch={refetchConfig} />}
            </TabsContent>

            {/* Catalog */}
            <TabsContent value="catalog" className="mt-4">
              {configLoading || !config ? (
                <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
              ) : <CatalogTab config={config} refetch={refetchConfig} />}
            </TabsContent>

            {/* Appearance */}
            <TabsContent value="appearance" className="space-y-4 mt-4">
              <StepBanner n={6} of={7} title="Appearance">
                How the widget looks on your site — color, position and theme. This is the last setup step; when you&apos;re happy with it, grab the Install Code.
              </StepBanner>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 space-y-5">
                  <div>
                    <label className="text-sm font-medium">Theme</label>
                    <div className="flex gap-3 mt-2">
                      {(["LIGHT", "DARK"] as const).map((t) => (
                        <button key={t} onClick={() => setSettings({ ...settings, theme: t })}
                          className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${settings.theme === t ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                          {t === "LIGHT" ? "☀️ Light" : "🌙 Dark"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Primary Color</label>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <input type="color" value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} className="h-10 w-14 rounded-lg cursor-pointer border p-0.5" />
                      <Input value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} className="w-32 font-mono text-sm" />
                      <div className="flex gap-2">
                        {["#6366f1", "#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#ec4899", "#0ea5e9"].map((c) => (
                          <button key={c} onClick={() => setSettings({ ...settings, primaryColor: c })} aria-label={`Set primary color to ${c}`}
                            className={`w-7 h-7 rounded-full border-2 shadow transition-transform hover:scale-110 ${settings.primaryColor === c ? "border-gray-700 scale-110" : "border-white"}`} style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Widget Position</label>
                    <div className="flex gap-3 mt-2">
                      {(["BOTTOM_RIGHT", "BOTTOM_LEFT"] as const).map((pos) => (
                        <button key={pos} onClick={() => setSettings({ ...settings, position: pos })}
                          className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${settings.position === pos ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                          {pos === "BOTTOM_RIGHT" ? "↘ Bottom Right" : "↙ Bottom Left"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-sm font-medium">Show Agent Avatar</p>
                      <p className="text-xs text-gray-400 mt-0.5">Display photos in chat messages</p>
                    </div>
                    <button onClick={() => setSettings({ ...settings, showAgentAvatar: !settings.showAgentAvatar })}
                      className={`w-11 h-6 rounded-full transition-colors ${settings.showAgentAvatar ? "bg-green-500" : "bg-red-400"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${settings.showAgentAvatar ? "translate-x-5" : ""}`} />
                    </button>
                  </div>
                </CardContent>
              </Card>
              <Button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Appearance
              </Button>
            </TabsContent>

            {/* Install */}
            <TabsContent value="install" className="space-y-4 mt-4">
              <StepBanner n={7} of={7} title="Install code">
                Copy this snippet into your website. That&apos;s the whole setup — every earlier step is already live in it.
              </StepBanner>
              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle className="text-base">Installation Code</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {activeKeys.length > 0 ? (
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Select API Key</label>
                      <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white font-mono" value={selectedKeyId || selectedKey?._id || ""} onChange={(e) => setSelectedKeyId(e.target.value)}>
                        {activeKeys.map((k: { _id: string; name: string; key: string }) => (
                          <option key={k._id} value={k._id}>{k.name} — {k.key.substring(0, 16)}…</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
                      No active API keys. <a href="/dashboard/api-keys" className="underline font-medium">Create one first →</a>
                    </div>
                  )}
                  <p className="text-sm text-gray-600">
                    Add this snippet to your website&apos;s HTML just before the closing <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> tag.
                  </p>
                  <div className="relative bg-gray-900 rounded-xl overflow-hidden">
                    <pre className="text-green-400 text-xs p-4 overflow-x-auto font-mono leading-relaxed">{snippetCode}</pre>
                    <Button size="sm" onClick={copySnippet} className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 h-7 gap-1">
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Hours */}
            <TabsContent value="hours" className="mt-4">
              {configLoading || !config ? (
                <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
              ) : <HoursTab config={config} refetch={refetchConfig} />}
            </TabsContent>

            {/* Canned */}
            <TabsContent value="canned" className="mt-4"><CannedTab /></TabsContent>

            {/* Realtime */}
            <TabsContent value="realtime" className="mt-4"><RealtimeTab /></TabsContent>
          </Tabs>
        </div>

        {/* ── Right: Live Chatbot Flow Preview ──────────────────────────────── */}
        <div className="xl:col-span-2">
          <div className="sticky top-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-500" />
                Live Preview
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full leading-none ml-1">● LIVE</span>
              </p>
              <span className="text-[11px] text-gray-400 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Click Restart to reset</span>
            </div>

            <ChatbotFlowPreview color={settings.primaryColor} theme={settings.theme} companyName={companyProfile?.name || ""} logo={companyProfile?.logo} />

            <p className="text-center text-xs text-gray-400">This is the real chatbot — same as what visitors see · No DB entries created</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatbotPage() {
  return (
    <Suspense fallback={<div className="space-y-4 p-6"><div className="h-8 w-64 bg-gray-200 rounded animate-pulse" /><div className="h-48 bg-gray-100 rounded-xl animate-pulse" /></div>}>
      <ChatbotPageInner />
    </Suspense>
  );
}
