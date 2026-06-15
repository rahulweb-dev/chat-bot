"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";

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
  settings?: { qualifyLeads: boolean; collectPhone: boolean; collectEmail: boolean; intentDetection: boolean };
  knowledgeBaseIds?: string[];
  stats?: { totalConversations: number; resolvedByBot: number; handedToAgent: number };
}

interface KBItem {
  _id: string;
  name: string;
  type: string;
  status: string;
}

interface TestMsg { role: "bot" | "user"; text: string; }

export default function ChatbotsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [configBot, setConfigBot] = useState<Chatbot | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(INDUSTRY_TEMPLATES[0]);
  const [form, setForm] = useState({ name: "", welcomeMessage: "", description: "" });
  const [configTab, setConfigTab] = useState("training");

  // Test Bot state
  const [testMsgs, setTestMsgs] = useState<TestMsg[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testSession, setTestSession] = useState<{ flow: string; step: string; collected: Record<string, string> }>({ flow: "INITIAL", step: "", collected: {} });
  const [testBusy, setTestBusy] = useState(false);
  const [testOpts, setTestOpts] = useState<string[]>([]);
  const testEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    testEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [testMsgs]);

  async function testSend(text: string) {
    if (!text.trim() || testBusy) return;
    setTestInput("");
    setTestOpts([]);
    setTestMsgs((m) => [...m, { role: "user", text }]);
    setTestBusy(true);
    try {
      const r = await fetch("/api/chatbots/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionData: testSession }),
      });
      const d = await r.json();
      if (d.success) {
        const msgs: string[] = d.data.messages || [];
        msgs.forEach((msg, i) => {
          setTimeout(() => {
            setTestMsgs((m) => [...m, { role: "bot", text: msg }]);
            if (i === msgs.length - 1) {
              setTestOpts(d.data.quickReplies || []);
              setTestSession(d.data.sessionData);
            }
          }, i * 500);
        });
      }
    } catch {
      setTestMsgs((m) => [...m, { role: "bot", text: "Error calling bot. Try again." }]);
    } finally {
      setTestBusy(false);
    }
  }

  function resetTest() {
    setTestMsgs([]);
    setTestOpts([]);
    setTestSession({ flow: "INITIAL", step: "", collected: {} });
    setTestInput("");
    // Auto start
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

  const chatbots = data || [];
  const kbItems = kbData || [];

  function applyTemplate(tpl: typeof INDUSTRY_TEMPLATES[0]) {
    setSelectedTemplate(tpl);
    setForm((f) => ({ ...f, welcomeMessage: tpl.welcomeMessage, description: tpl.description }));
  }

  return (
    <div className="space-y-6 ">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Chatbots</h1>
          <p className="text-gray-500 text-sm mt-1">Train and deploy AI-powered bots to handle customer queries automatically</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> New Chatbot
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle>Create New Chatbot</DialogTitle>
            </DialogHeader>

            {/* Template picker */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Industry Template</Label>
              <div className="grid grid-cols-2 gap-2">
                {INDUSTRY_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      selectedTemplate.id === t.id
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-xl">{t.icon}</span>
                    <p className="text-sm font-medium mt-1">{t.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate({
                  name: form.name,
                  welcomeMessage: form.welcomeMessage,
                  description: form.description,
                  type: "CUSTOM",
                  isActive: true,
                  settings: { qualifyLeads: true, collectPhone: true, collectEmail: true, intentDetection: true },
                });
              }}
              className="space-y-4 mt-2"
            >
              <div className="space-y-1.5">
                <Label>Bot Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Dealership Assistant" required />
              </div>

              <div className="space-y-1.5">
                <Label>Welcome Message</Label>
                <textarea
                  value={form.welcomeMessage}
                  onChange={(e) => setForm((f) => ({ ...f, welcomeMessage: e.target.value }))}
                  rows={5}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="First message the bot sends..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>System Prompt / Training Instructions</Label>
                <p className="text-xs text-gray-400">This tells the AI how to behave, what intents to detect, and what flows to follow.</p>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={8}
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
      </div>

      {/* How it works banner */}
      <Card className="border-0 shadow-sm bg-linear-to-r from-indigo-50 to-purple-50">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">How the Chatbot Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                {[
                  { icon: "1️⃣", text: "Visitor sends message via widget on your website" },
                  { icon: "2️⃣", text: "AI detects intent (Price, Test Drive, Service…)" },
                  { icon: "3️⃣", text: "Bot follows trained flow, collects lead/ticket data" },
                  { icon: "4️⃣", text: "Lead/Ticket created in your dashboard automatically" },
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

      {/* Bot list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      ) : chatbots.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-indigo-400" />
            </div>
            <p className="text-gray-700 font-semibold text-lg">No chatbots yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">Create your first bot using the Automobile Dealership template</p>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Dealership Bot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {chatbots.map((bot) => (
            <Card key={bot._id} className="border-0 shadow-sm group relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{bot.name}</CardTitle>
                      <Badge variant={bot.isActive ? "active" : "inactive"} className="text-[10px] mt-1">
                        {bot.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConfigBot(bot)}>
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => { if (confirm("Delete this chatbot?")) deleteBot.mutate(bot._id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {bot.welcomeMessage && (
                  <p className="text-xs text-gray-400 italic line-clamp-2 bg-gray-50 rounded-lg p-2">
                    &ldquo;{bot.welcomeMessage.slice(0, 80)}&rdquo;
                  </p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-base font-bold text-gray-800">{bot.stats?.totalConversations || 0}</p>
                    <p className="text-[10px] text-gray-400">Chats</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-base font-bold text-green-700">{bot.stats?.resolvedByBot || 0}</p>
                    <p className="text-[10px] text-gray-400">Resolved</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2">
                    <p className="text-base font-bold text-orange-700">{bot.stats?.handedToAgent || 0}</p>
                    <p className="text-[10px] text-gray-400">Escalated</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-500">Bot Active</Label>
                  <Switch
                    checked={bot.isActive}
                    onCheckedChange={(v) => updateBot.mutate({ id: bot._id, data: { isActive: v } })}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Configure Dialog ───────────────────────────────────────────────── */}
      {configBot && (
        <Dialog open={!!configBot} onOpenChange={() => setConfigBot(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-500" />
                Configure: {configBot.name}
              </DialogTitle>
            </DialogHeader>

            <Tabs value={configTab} onValueChange={(v) => { setConfigTab(v); if (v === "test" && testMsgs.length === 0) setTimeout(() => testSend("__INIT__"), 50); }}>
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
                  <p>The <strong>System Prompt</strong> is the brain of your bot. It defines how the bot behaves, what intents it detects, what flows it follows, and when to create leads/tickets. The more specific your prompt, the better the bot performs.</p>
                </div>

                <div className="space-y-2">
                  <Label>Welcome Message</Label>
                  <textarea
                    defaultValue={configBot.welcomeMessage}
                    id="cfg-welcome"
                    rows={5}
                    className="w-full border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>

                <div className="space-y-2">
                  <Label>System Prompt / Training Instructions</Label>
                  <textarea
                    defaultValue={configBot.description}
                    id="cfg-prompt"
                    rows={12}
                    className="w-full border rounded-lg p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder={INDUSTRY_TEMPLATES[0].description}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => {
                      const el = document.getElementById("cfg-prompt") as HTMLTextAreaElement;
                      if (el) el.value = INDUSTRY_TEMPLATES[0].description;
                    }}
                  >
                    <Car className="w-3.5 h-3.5 mr-1.5" /> Load Dealership Template
                  </Button>
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => {
                      const welcomeEl = document.getElementById("cfg-welcome") as HTMLTextAreaElement;
                      const promptEl = document.getElementById("cfg-prompt") as HTMLTextAreaElement;
                      updateBot.mutate({
                        id: configBot._id,
                        data: { welcomeMessage: welcomeEl?.value, description: promptEl?.value },
                      });
                    }}
                    disabled={updateBot.isPending}
                  >
                    {updateBot.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Training
                  </Button>
                </div>
              </TabsContent>

              {/* Intents Tab */}
              <TabsContent value="intents" className="mt-4">
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">These are the intents your bot can detect. They are defined in your system prompt and automatically handled.</p>
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
                    <p className="font-semibold flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-4 h-4" /> Escalation Triggers
                    </p>
                    <p>Bot auto-assigns to agent when visitor says: <strong>talk to human, sales executive, call me, need quotation, manager, complaint, refund, legal issue</strong></p>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                    <p className="font-semibold mb-1">🎯 Auto Lead Creation Rules</p>
                    <ul className="space-y-1 text-xs">
                      <li>• <strong>TEST_DRIVE</strong> → Lead created (score: 80, type: TEST_DRIVE)</li>
                      <li>• <strong>EXCHANGE</strong> → Lead created (score: 70, type: EXCHANGE)</li>
                      <li>• <strong>PRICE_INQUIRY</strong> → Lead created (score: 60, type: PRICE_INQUIRY)</li>
                      <li>• <strong>FINANCE</strong> → Lead created (score: 65, type: FINANCE)</li>
                      <li>• <strong>SERVICE</strong> → Service Ticket created automatically</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              {/* Knowledge Base Tab */}
              <TabsContent value="knowledge" className="mt-4">
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
                    <p className="font-semibold mb-1">📄 Knowledge Base Documents</p>
                    <p>Attach documents that the bot uses to answer questions about your vehicles, prices, specs, offers etc. Upload documents in <strong>Dashboard → Knowledge Base</strong> first.</p>
                    <p className="mt-1 text-xs font-medium">Recommended: Price Lists, Variant Brochures, Service Packages, FAQ, Offers, Warranty Docs</p>
                  </div>

                  {kbItems.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-xl">
                      <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No knowledge base documents found.</p>
                      <p className="text-xs text-gray-400 mt-1">Go to Dashboard → Knowledge Base to upload files.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {kbItems.map((kb) => {
                        const isAttached = (configBot.knowledgeBaseIds || []).includes(kb._id);
                        return (
                          <div key={kb._id} className="flex items-center justify-between p-3 border rounded-xl">
                            <div className="flex items-center gap-3">
                              <BookOpen className="w-4 h-4 text-indigo-500" />
                              <div>
                                <p className="text-sm font-medium">{kb.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="secondary" className="text-[10px]">{kb.type}</Badge>
                                  <Badge variant={kb.status === "READY" ? "success" : "warning"} className="text-[10px]">{kb.status}</Badge>
                                </div>
                              </div>
                            </div>
                            <Switch
                              checked={isAttached}
                              onCheckedChange={(v) => {
                                const ids = configBot.knowledgeBaseIds || [];
                                const newIds = v ? [...ids, kb._id] : ids.filter((id) => id !== kb._id);
                                updateBot.mutate({ id: configBot._id, data: { knowledgeBaseIds: newIds } });
                                setConfigBot({ ...configBot, knowledgeBaseIds: newIds });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="mt-4">
                <div className="space-y-4">
                  {[
                    { key: "qualifyLeads", label: "Auto Lead Qualification", desc: "Automatically create leads when visitors share contact info" },
                    { key: "collectPhone", label: "Collect Phone Number", desc: "Ask visitor for phone number during key flows" },
                    { key: "collectEmail", label: "Collect Email Address", desc: "Ask visitor for email during key flows" },
                    { key: "intentDetection", label: "Intent Detection", desc: "Auto-detect customer intent from each message" },
                  ].map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between p-4 border rounded-xl">
                      <div>
                        <p className="text-sm font-medium">{setting.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{setting.desc}</p>
                      </div>
                      <Switch
                        checked={configBot.settings?.[setting.key as keyof typeof configBot.settings] ?? true}
                        onCheckedChange={(v) => {
                          updateBot.mutate({ id: configBot._id, data: { [`settings.${setting.key}`]: v } });
                        }}
                      />
                    </div>
                  ))}

                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5 mb-3">
                      <Trash2 className="w-4 h-4" /> Danger Zone
                    </p>
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm("Delete this chatbot permanently?")) {
                          deleteBot.mutate(configBot._id);
                          setConfigBot(null);
                        }
                      }}
                    >
                      Delete Chatbot
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Test Bot Tab */}
              <TabsContent value="test" className="mt-4">
                <div className="flex flex-col" style={{ height: 420 }}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Live Bot Tester</p>
                      <p className="text-xs text-gray-400">Chat with your bot exactly as a visitor would</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={resetTest} className="gap-1.5 text-xs">
                      <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </Button>
                  </div>

                  {/* Chat messages */}
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
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                            m.role === "user"
                              ? "bg-indigo-600 text-white rounded-br-sm"
                              : "bg-white border text-gray-800 rounded-bl-sm shadow-sm"
                          }`}
                        >
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

                  {/* Quick replies */}
                  {testOpts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
                      {testOpts.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => testSend(opt)}
                          disabled={testBusy}
                          className="text-xs border border-indigo-400 text-indigo-600 rounded-lg px-2.5 py-1.5 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input */}
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); testSend(testInput); } }}
                      placeholder="Type a test message…"
                      disabled={testBusy}
                      className="text-sm"
                    />
                    <Button
                      size="icon"
                      className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
                      onClick={() => testSend(testInput)}
                      disabled={testBusy || !testInput.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Training Guide */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            Automobile Dealership — Training Map Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: "🚗 New Cars", flow: "Customer asks → Show categories (Hatchback/Sedan/SUV/EV) → Show models → Price/Test Drive" },
              { title: "💰 Price Inquiry", flow: "Ask city → Show on-road price range → Offer EMI / Test Drive / Executive call" },
              { title: "📅 Test Drive", flow: "Collect Name + Phone + Vehicle + Date + Time → Confirm → Lead created (HOT)" },
              { title: "🧾 Finance/EMI", flow: "Collect Vehicle + Down Payment + Tenure → Estimate EMI → Offer finance executive" },
              { title: "🔄 Exchange", flow: "Collect Brand + Model + Year + KMs → Lead created (type=EXCHANGE)" },
              { title: "🛠 Service", flow: "Collect Vehicle No + Model + Mobile + Service Type → Ticket created" },
              { title: "🎁 Offers", flow: "List offer types → Offer personalized quotation → Collect lead" },
              { title: "📞 Escalate", flow: "On 'talk to human / call me / executive' → Assign to available agent" },
              { title: "📍 Location", flow: "Show showroom list → Address + map link + contact number" },
            ].map((item) => (
              <div key={item.title} className="bg-gray-50 rounded-xl p-3 border">
                <p className="text-sm font-semibold text-gray-800 mb-1">{item.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.flow}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-indigo-800 mb-2">📂 Knowledge Base Documents to Upload</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                "Vehicle Brochures", "Price Lists", "Variant Details", "Mileage Data",
                "Accessories Catalog", "Service Packages", "Warranty Documents", "Insurance Plans",
                "Finance Schemes", "Exchange Offers", "Dealer Locations", "Current Offers",
                "Festival Offers", "Corporate Discounts", "RTO Charges", "FAQ Document",
              ].map((doc) => (
                <div key={doc} className="flex items-center gap-1.5 text-xs text-indigo-700">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  {doc}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
