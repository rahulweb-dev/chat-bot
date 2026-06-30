"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  Loader2, Plus, Bot, MessageSquare, Trash2, Settings,
  BookOpen, Zap, AlertTriangle, CheckCircle2, Brain, Car, Send, RotateCcw,
  Globe, Pencil, Copy, Search, Filter, BarChart3, HelpCircle, CheckCircle, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const INDUSTRY_TEMPLATES = [
  {
    id: "automobile",
    label: "Automobile Dealership",
    icon: "🚗",
    welcomeMessage: "Hello! 👋\n\nWelcome to our Dealership.\n\nI can help you with:\n🚗 New Cars\n💰 Price & Offers\n📅 Test Drive\n🧾 Finance & EMI\n🔄 Exchange Vehicle\n🛠 Service Booking\n\nHow may I help you today?",
    description: `You are an expert automobile dealership AI assistant.

INTENTS: PRICE_INQUIRY | TEST_DRIVE | FINANCE | EXCHANGE | SERVICE | ACCESSORIES | INSURANCE | WARRANTY | LOCATION | OFFERS | COMPARE | EV | ESCALATE | GENERAL_QUERY

FLOWS:
- PRICE_INQUIRY → ask city → show estimated price range → offer EMI/Test Drive/Executive contact
- TEST_DRIVE → collect Name, Phone, Vehicle, Date, Time → confirm booking → action=CREATE_LEAD (type=TEST_DRIVE, score=80)
- FINANCE → collect Vehicle, Down Payment, Tenure → estimate EMI → offer finance executive
- EXCHANGE → collect Brand, Model, Year, KMs Driven → action=CREATE_LEAD (type=EXCHANGE, score=70)
- SERVICE → collect Vehicle Number, Model, Mobile, Service Type → action=CREATE_TICKET (category=SERVICE)
- OFFERS → list: Cash Discount, Exchange Bonus, Corporate Discount, Loyalty Bonus, Finance Benefits → offer quotation
- LOCATION → show showroom list → address + contact

LEAD SCORING: Hot (score 80-100) = test drive + price + within 30 days | Warm (60-79) = price/finance asked | Cold (<60) = browsing

ESCALATE immediately when: "talk to human / call me / need quotation / manager / complaint / sales executive"

Always keep messages short, friendly, use emojis. Offer quick replies. Collect one field at a time.`,
    tags: ["auto", "dealership", "cars"],
  },
  {
    id: "ecommerce",
    label: "E-Commerce Support",
    icon: "🛒",
    welcomeMessage: "Hi there! 👋 Welcome to our store. How can I help you today?",
    description: `You are an e-commerce customer support AI. Help with: Orders | Returns | Refunds | Product Info | Shipping | Payment Issues.
ESCALATE when: "complaint / refund / damaged / wrong item / talk to human"`,
    tags: ["ecommerce", "support"],
  },
  {
    id: "realestate",
    label: "Real Estate",
    icon: "🏠",
    welcomeMessage: "Hello! 👋 Looking to buy, rent or sell a property? I can help!",
    description: `You are a real estate assistant. Help with: Property Search | Site Visits | Pricing | Home Loans | Legal Queries.
Collect: Budget, Location preference, BHK, Purpose (Buy/Rent/Invest).`,
    tags: ["real estate", "property"],
  },
  {
    id: "general",
    label: "General Support",
    icon: "💬",
    welcomeMessage: "Hi! How can I help you today?",
    description: "You are a helpful customer support AI. Be professional, empathetic and concise. Escalate complex issues to human agents.",
    tags: ["support"],
  },
];

const INTENT_LABELS: Record<string, string> = {
  PRICE_INQUIRY: "Price Inquiry",
  TEST_DRIVE: "Test Drive",
  FINANCE: "Finance/EMI",
  EXCHANGE: "Exchange Vehicle",
  SERVICE: "Service Booking",
  ACCESSORIES: "Accessories",
  INSURANCE: "Insurance",
  WARRANTY: "Warranty",
  LOCATION: "Location",
  OFFERS: "Offers",
  ESCALATE: "Escalate to Agent",
  GENERAL_QUERY: "General Query",
};

interface Chatbot {
  _id: string;
  name: string;
  welcomeMessage?: string;
  description?: string;
  isActive: boolean;
  type: string;
  channel?: string;
  settings?: { qualifyLeads: boolean; collectPhone: boolean; collectEmail: boolean; intentDetection: boolean };
  knowledgeBaseIds?: string[];
  stats?: { totalConversations: number; resolvedByBot: number; handedToAgent: number };
  createdAt?: string;
  updatedAt?: string;
}

interface KBItem {
  _id: string;
  name: string;
  type: string;
  status: string;
}

interface TestMsg { role: "bot" | "user"; text: string; }

function ChannelIcon({ channel, className }: { channel?: string; className?: string }) {
  const ch = (channel || "WEB").toUpperCase();
  if (ch === "WHATSAPP")
    return (
      <div className={cn("rounded-full bg-green-500 flex items-center justify-center text-white shrink-0", className)}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-[55%] h-[55%]">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.557 4.126 1.532 5.861L0 24l6.303-1.505A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.896 0-3.673-.501-5.207-1.378l-.373-.22-3.742.893.927-3.636-.243-.384A9.945 9.945 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
        </svg>
      </div>
    );
  return (
    <div className={cn("rounded-full bg-indigo-500 flex items-center justify-center text-white shrink-0", className)}>
      <Globe className="w-[50%] h-[50%]" />
    </div>
  );
}

function fmtDate(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function ChatbotsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"chat" | "voice">("chat");
  const [createOpen, setCreateOpen] = useState(false);
  const [configBot, setConfigBot] = useState<Chatbot | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(INDUSTRY_TEMPLATES[0]);
  const [form, setForm] = useState({ name: "", welcomeMessage: "", description: "" });
  const [configTab, setConfigTab] = useState("training");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Test Bot state
  const [testMsgs, setTestMsgs] = useState<TestMsg[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testSession, setTestSession] = useState<{ flow: string; step: string; collected: Record<string, string> }>({ flow: "INITIAL", step: "", collected: { name: "Test" } });
  const [testBusy, setTestBusy] = useState(false);
  const [testOpts, setTestOpts] = useState<string[]>([]);
  const testEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { testEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [testMsgs]);

  async function testSend(text: string) {
    if (!text.trim() || testBusy) return;
    setTestInput("");
    setTestOpts([]);
    if (text !== "__INIT__") setTestMsgs(m => [...m, { role: "user", text }]);
    setTestBusy(true);
    try {
      const r = await fetch("/api/chatbots/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionData: testSession, chatbotId: configBot?._id }),
      });
      const d = await r.json();
      if (d.success) {
        const msgs: string[] = d.data.messages || [];
        msgs.forEach((msg, i) => {
          setTimeout(() => {
            setTestMsgs(m => [...m, { role: "bot", text: msg }]);
            if (i === msgs.length - 1) { setTestOpts(d.data.quickReplies || []); setTestSession(d.data.sessionData); }
          }, i * 500);
        });
      }
    } catch {
      setTestMsgs(m => [...m, { role: "bot", text: "Error calling bot. Try again." }]);
    } finally { setTestBusy(false); }
  }

  function resetTest() {
    setTestMsgs([]); setTestOpts([]);
    setTestSession({ flow: "INITIAL", step: "", collected: { name: "Test" } });
    setTestInput("");
    setTimeout(() => testSend("__INIT__"), 100);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["chatbots"],
    queryFn: async () => {
      const r = await fetch("/api/chatbots");
      const d = await r.json();
      return d.data as Chatbot[];
    },
  });

  const { data: kbData } = useQuery({
    queryKey: ["kb-list"],
    queryFn: async () => {
      const r = await fetch("/api/knowledge-base");
      const d = await r.json();
      return d.data as KBItem[];
    },
  });

  const create = useMutation({
    mutationFn: async (body: unknown) => {
      const r = await fetch("/api/chatbots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return r.json();
    },
    onSuccess: (d) => {
      if (d.success) { qc.invalidateQueries({ queryKey: ["chatbots"] }); setCreateOpen(false); toast({ title: "Chatbot created!" }); }
      else toast({ title: d.error || "Failed", variant: "destructive" });
    },
  });

  const updateBot = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: unknown }) => {
      const r = await fetch(`/api/chatbots/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      return r.json();
    },
    onSuccess: (d) => {
      if (d.success) { qc.invalidateQueries({ queryKey: ["chatbots"] }); toast({ title: "Chatbot updated" }); }
      else toast({ title: d.error || "Update failed", variant: "destructive" });
    },
  });

  const deleteBot = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/chatbots/${id}`, { method: "DELETE" });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["chatbots"] }); toast({ title: "Deleted" }); },
  });

  function applyTemplate(tpl: typeof INDUSTRY_TEMPLATES[0]) {
    setSelectedTemplate(tpl);
    setForm(f => ({ ...f, welcomeMessage: tpl.welcomeMessage, description: tpl.description }));
  }

  const chatbots = (data || []).filter(b => {
    if (statusFilter === "ACTIVE" && !b.isActive) return false;
    if (statusFilter === "INACTIVE" && b.isActive) return false;
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const kbItems = kbData || [];

  return (
    <div className="min-h-screen bg-gray-50 -m-6">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b px-6 pt-6 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-xl font-bold text-gray-900">Manage Bots</h1>
          <HelpCircle className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "px-5 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors",
              activeTab === "chat"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            )}
          >
            Chat Bots
          </button>
          <button
            onClick={() => setActiveTab("voice")}
            className={cn(
              "px-5 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors",
              activeTab === "voice"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            )}
          >
            Voice Bots
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="p-6 space-y-5">
        {/* Voice Bots placeholder */}
        {activeTab === "voice" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-gray-400" />
              </div>
              <p className="font-semibold text-gray-700">Voice Bots — Coming Soon</p>
              <p className="text-sm text-gray-400 mt-1">AI-powered voice bot support is on our roadmap</p>
            </CardContent>
          </Card>
        )}

        {activeTab === "chat" && (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-gray-500 font-medium">Create And Manage Bots</p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Type Here To Search Bots"
                    className="pl-8 h-8 text-xs w-52 bg-white"
                  />
                </div>
                {/* Filter */}
                <div className="flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
                    className="text-xs border border-gray-200 rounded-lg h-8 px-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="ALL">All</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                {/* Bot Report */}
                <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 text-xs gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Bot Report
                </Button>
              </div>
            </div>

            {/* Bot Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

                {/* Create New Bot Card */}
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <button className="bg-white border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-3 p-8 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group min-h-[220px]">
                      <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 group-hover:border-indigo-400 flex items-center justify-center transition-colors">
                        <Plus className="w-6 h-6 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <span className="text-sm font-semibold text-indigo-600 group-hover:text-indigo-700">Create a New Bot</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
                    <DialogHeader>
                      <DialogTitle>Create New Chatbot</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">Industry Template</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {INDUSTRY_TEMPLATES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => applyTemplate(t)}
                            className={cn(
                              "p-3 rounded-xl border-2 text-left transition-all",
                              selectedTemplate.id === t.id ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                            )}
                          >
                            <span className="text-xl">{t.icon}</span>
                            <p className="text-sm font-medium mt-1">{t.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        create.mutate({
                          name: form.name, welcomeMessage: form.welcomeMessage,
                          description: form.description, type: "CUSTOM", isActive: true,
                          settings: { qualifyLeads: true, collectPhone: true, collectEmail: true, intentDetection: true },
                        });
                      }}
                      className="space-y-4 mt-2"
                    >
                      <div className="space-y-1.5">
                        <Label>Bot Name</Label>
                        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Dealership Assistant" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Welcome Message</Label>
                        <textarea
                          value={form.welcomeMessage}
                          onChange={e => setForm(f => ({ ...f, welcomeMessage: e.target.value }))}
                          rows={4}
                          className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          placeholder="First message the bot sends..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>System Prompt / Training Instructions</Label>
                        <p className="text-xs text-gray-400">Defines how the AI behaves, what intents to detect, and what flows to follow.</p>
                        <textarea
                          value={form.description}
                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                          rows={7}
                          className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          placeholder="Paste your training prompt here..."
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={create.isPending}>
                          {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Create Chatbot
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* Bot Cards */}
                {chatbots.map(bot => (
                  <div key={bot._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                    {/* Card Header */}
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ChannelIcon channel={bot.channel || bot.type} className="w-9 h-9" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate max-w-[120px]">{bot.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setConfigBot(bot); setConfigTab("training"); }}
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { navigator.clipboard.writeText(bot._id); toast({ title: "ID copied" }); }}
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-colors"
                            title="Copy ID"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5 font-mono truncate">ID: {bot._id}</p>
                    </div>

                    {/* Card Body */}
                    <div className="px-4 pb-3 grid grid-cols-2 gap-x-3 gap-y-2.5 flex-1">
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Created On</p>
                        <p className="text-xs text-gray-700 font-medium leading-snug">{fmtDate(bot.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Chat Count</p>
                        <p className="text-xs text-gray-700 font-medium">
                          {(bot.stats?.totalConversations || 0).toLocaleString()} Visitors
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Updated On</p>
                        <p className="text-xs text-gray-700 font-medium leading-snug">{fmtDate(bot.updatedAt)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Status</p>
                        <span className={cn(
                          "inline-flex items-center gap-1 text-xs font-semibold",
                          bot.isActive ? "text-emerald-600" : "text-red-500"
                        )}>
                          {bot.isActive
                            ? <><CheckCircle className="w-3 h-3" /> Active</>
                            : <><XCircle className="w-3 h-3" /> Inactive</>
                          }
                        </span>
                      </div>
                    </div>

                    {/* View Details button */}
                    <button
                      onClick={() => { setConfigBot(bot); setConfigTab("training"); }}
                      className="w-full border-t border-gray-100 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors text-center"
                    >
                      View Details
                    </button>
                  </div>
                ))}

                {/* Empty search state */}
                {chatbots.length === 0 && (data || []).length > 0 && (
                  <div className="col-span-full text-center py-12 text-gray-400">
                    <Search className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No bots match your search</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Configure / View Details Dialog ───────────────────────────────────── */}
      {configBot && (
        <Dialog open={!!configBot} onOpenChange={() => setConfigBot(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <ChannelIcon channel={configBot.channel || configBot.type} className="w-8 h-8" />
                <div>
                  <p className="font-bold">{configBot.name}</p>
                  <p className="text-[11px] font-mono text-gray-400 font-normal">ID: {configBot._id}</p>
                </div>
                <span className={cn(
                  "ml-auto text-xs font-semibold px-2.5 py-1 rounded-full",
                  configBot.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                )}>
                  {configBot.isActive ? "Active" : "Inactive"}
                </span>
              </DialogTitle>
            </DialogHeader>

            <Tabs value={configTab} onValueChange={v => { setConfigTab(v); if (v === "test" && testMsgs.length === 0) setTimeout(() => testSend("__INIT__"), 50); }}>
              <TabsList className="grid grid-cols-5">
                <TabsTrigger value="training"><Brain className="w-3.5 h-3.5 mr-1" />Training</TabsTrigger>
                <TabsTrigger value="intents"><Zap className="w-3.5 h-3.5 mr-1" />Intents</TabsTrigger>
                <TabsTrigger value="knowledge"><BookOpen className="w-3.5 h-3.5 mr-1" />KB</TabsTrigger>
                <TabsTrigger value="settings"><Settings className="w-3.5 h-3.5 mr-1" />Settings</TabsTrigger>
                <TabsTrigger value="test"><MessageSquare className="w-3.5 h-3.5 mr-1" />Test Bot</TabsTrigger>
              </TabsList>

              {/* Training Tab */}
              <TabsContent value="training" className="space-y-4 mt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                  <p className="font-semibold mb-1">📚 How Training Works</p>
                  <p>The <strong>System Prompt</strong> is the brain of your bot. It defines how the bot behaves, what intents it detects, what flows it follows, and when to create leads/tickets.</p>
                </div>
                <div className="space-y-2">
                  <Label>Welcome Message</Label>
                  <textarea defaultValue={configBot.welcomeMessage} id="cfg-welcome" rows={5}
                    className="w-full border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div className="space-y-2">
                  <Label>System Prompt / Training Instructions</Label>
                  <textarea defaultValue={configBot.description} id="cfg-prompt" rows={12}
                    className="w-full border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder={INDUSTRY_TEMPLATES[0].description} />
                </div>
                <div className="flex justify-between items-center">
                  <Button variant="outline" size="sm"
                    onClick={() => { const el = document.getElementById("cfg-prompt") as HTMLTextAreaElement; if (el) el.value = INDUSTRY_TEMPLATES[0].description; }}>
                    <Car className="w-3.5 h-3.5 mr-1.5" /> Load Dealership Template
                  </Button>
                  <Button className="bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => {
                      const w = document.getElementById("cfg-welcome") as HTMLTextAreaElement;
                      const p = document.getElementById("cfg-prompt") as HTMLTextAreaElement;
                      updateBot.mutate({ id: configBot._id, data: { welcomeMessage: w?.value, description: p?.value } });
                    }}
                    disabled={updateBot.isPending}>
                    {updateBot.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Save Training
                  </Button>
                </div>
              </TabsContent>

              {/* Intents Tab */}
              <TabsContent value="intents" className="mt-4 space-y-3">
                <p className="text-sm text-gray-500">Intents your bot detects — defined in the system prompt and automatically handled.</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(INTENT_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3 p-3 border rounded-xl">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{key}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  <p className="font-semibold flex items-center gap-1.5 mb-1"><AlertTriangle className="w-4 h-4" /> Escalation Triggers</p>
                  <p>Bot auto-assigns to agent when visitor says: <strong>talk to human, sales executive, call me, need quotation, manager, complaint</strong></p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                  <p className="font-semibold mb-1">🎯 Auto Lead Creation Rules</p>
                  <ul className="space-y-1 text-xs">
                    <li>• <strong>TEST_DRIVE</strong> → Lead (score: 80)</li>
                    <li>• <strong>EXCHANGE</strong> → Lead (score: 70)</li>
                    <li>• <strong>PRICE_INQUIRY</strong> → Lead (score: 60)</li>
                    <li>• <strong>SERVICE</strong> → Service Ticket created</li>
                  </ul>
                </div>
              </TabsContent>

              {/* KB Tab */}
              <TabsContent value="knowledge" className="mt-4">
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
                    <p className="font-semibold mb-1">📄 Knowledge Base Documents</p>
                    <p>Attach documents the bot uses to answer questions. Upload in <strong>Dashboard → Knowledge Base</strong> first.</p>
                    <p className="text-xs font-medium mt-1">Recommended: Price Lists, Brochures, Service Packages, FAQ, Offers</p>
                  </div>
                  {kbItems.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl">
                      <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No knowledge base documents found.</p>
                      <p className="text-xs text-gray-400 mt-1">Go to Knowledge Base to upload files.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {kbItems.map(kb => {
                        const isAttached = (configBot.knowledgeBaseIds || []).includes(kb._id);
                        return (
                          <div key={kb._id} className="flex items-center justify-between p-3 border rounded-xl">
                            <div className="flex items-center gap-3">
                              <BookOpen className="w-4 h-4 text-indigo-500" />
                              <div>
                                <p className="text-sm font-medium">{kb.name}</p>
                                <div className="flex gap-2 mt-0.5">
                                  <Badge variant="secondary" className="text-[10px]">{kb.type}</Badge>
                                  <Badge variant={kb.status === "READY" ? "success" : "warning"} className="text-[10px]">{kb.status}</Badge>
                                </div>
                              </div>
                            </div>
                            <Switch checked={isAttached}
                              onCheckedChange={v => {
                                const ids = configBot.knowledgeBaseIds || [];
                                const newIds = v ? [...ids, kb._id] : ids.filter(id => id !== kb._id);
                                updateBot.mutate({ id: configBot._id, data: { knowledgeBaseIds: newIds } });
                                setConfigBot({ ...configBot, knowledgeBaseIds: newIds });
                              }} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="mt-4">
                <div className="space-y-3">
                  {[
                    { key: "qualifyLeads", label: "Auto Lead Qualification", desc: "Automatically create leads when visitors share contact info" },
                    { key: "collectPhone", label: "Collect Phone Number", desc: "Ask visitor for phone during key flows" },
                    { key: "collectEmail", label: "Collect Email Address", desc: "Ask visitor for email during key flows" },
                    { key: "intentDetection", label: "Intent Detection", desc: "Auto-detect customer intent from each message" },
                  ].map(s => (
                    <div key={s.key} className="flex items-center justify-between p-4 border rounded-xl">
                      <div>
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                      </div>
                      <Switch
                        checked={configBot.settings?.[s.key as keyof typeof configBot.settings] ?? true}
                        onCheckedChange={v => updateBot.mutate({ id: configBot._id, data: { [`settings.${s.key}`]: v } })}
                      />
                    </div>
                  ))}

                  {/* Active toggle */}
                  <div className="flex items-center justify-between p-4 border rounded-xl bg-gray-50">
                    <div>
                      <p className="text-sm font-medium">Bot Active</p>
                      <p className="text-xs text-gray-400 mt-0.5">Enable or disable this bot entirely</p>
                    </div>
                    <Switch
                      checked={configBot.isActive}
                      onCheckedChange={v => {
                        updateBot.mutate({ id: configBot._id, data: { isActive: v } });
                        setConfigBot({ ...configBot, isActive: v });
                      }}
                    />
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5 mb-3">
                      <Trash2 className="w-4 h-4" /> Danger Zone
                    </p>
                    <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => { if (confirm("Delete this chatbot permanently?")) { deleteBot.mutate(configBot._id); setConfigBot(null); } }}>
                      Delete Chatbot
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Test Bot Tab */}
              <TabsContent value="test" className="mt-4">
                <div className="flex flex-col" style={{ height: 420 }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Live Bot Tester</p>
                      <p className="text-xs text-gray-400">Chat with your bot exactly as a visitor would</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={resetTest} className="gap-1.5 text-xs">
                      <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto border rounded-xl bg-gray-50 p-3 space-y-2 min-h-0">
                    {testMsgs.length === 0 && (
                      <div className="flex items-center justify-center h-full text-center text-gray-400">
                        <div>
                          <Bot className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">Click the tab to start a test conversation</p>
                        </div>
                      </div>
                    )}
                    {testMsgs.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={cn(
                          "max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed",
                          m.role === "user" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white border text-gray-800 rounded-bl-sm shadow-sm"
                        )}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {testBusy && (
                      <div className="flex justify-start">
                        <div className="bg-white border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center shadow-sm">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    )}
                    <div ref={testEndRef} />
                  </div>
                  {testOpts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
                      {testOpts.map(opt => (
                        <button key={opt} onClick={() => testSend(opt)} disabled={testBusy}
                          className="text-xs border border-indigo-400 text-indigo-600 rounded-lg px-2.5 py-1.5 hover:bg-indigo-50 transition-colors disabled:opacity-50">
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Input value={testInput} onChange={e => setTestInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); testSend(testInput); } }}
                      placeholder="Type a test message…" disabled={testBusy} className="text-sm" />
                    <Button size="icon" className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
                      onClick={() => testSend(testInput)} disabled={testBusy || !testInput.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
