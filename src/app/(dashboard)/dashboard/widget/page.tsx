"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Copy, Check, Code, Palette, Eye, GitBranch, ChevronDown, ChevronRight, Tag, Ticket, UserCheck, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ── Flow definition (mirrors chatbot-flow.ts MAIN_MENU — Ashok Leyland) ───────
const FLOWS = [
  {
    key: "find_vehicle", label: "🚛 Find a Vehicle", color: "#6366f1", bg: "#ede9fe",
    steps: [
      { q: "Vehicle type?",      opts: ["Light CV", "Intermediate CV", "Heavy Duty", "Bus", "Electric"] },
      { q: "Usage purpose?",     opts: ["Logistics", "Cargo", "Construction", "Agriculture", "E-commerce"] },
      { q: "Payload required?",  opts: ["Under 2T", "2-5T", "5-10T", "10-20T", "Above 20T"] },
      { q: "Fuel preference?",   opts: ["Diesel", "CNG", "Electric", "Not Sure"] },
      { q: "🚛 AI recommendation shown", opts: [] },
    ],
    outcome: "CREATE_LEAD",
  },
  {
    key: "on_road_price", label: "💰 Get On-Road Price", color: "#f59e0b", bg: "#fef3c7",
    steps: [
      { q: "Select vehicle?",    opts: ["Dost+", "Ecomet 912", "AVTR 4940", "Circuit S"] },
      { q: "Select variant?",    opts: ["Base", "Standard", "Plus", "Premium"] },
      { q: "Your city?",         opts: ["Mumbai", "Delhi", "Chennai", "Bangalore"] },
      { q: "💰 Estimated price shown", opts: [] },
    ],
    outcome: "NONE",
  },
  {
    key: "brochure", label: "📄 Download Brochure", color: "#0ea5e9", bg: "#e0f2fe",
    steps: [
      { q: "Select vehicle?",    opts: ["Dost+", "Ecomet 912", "AVTR 4940", "Circuit S"] },
      { q: "Your name?",         opts: [], input: true },
      { q: "Mobile number?",     opts: [], input: true },
      { q: "Email address?",     opts: [], input: true },
      { q: "Your city?",         opts: ["Mumbai", "Delhi", "Chennai", "Hyderabad"] },
    ],
    outcome: "CREATE_LEAD",
  },
  {
    key: "test_drive", label: "🚗 Book Test Drive", color: "#22c55e", bg: "#dcfce7",
    steps: [
      { q: "Select vehicle?",    opts: ["Dost+", "Ecomet 912", "AVTR 4940", "Other"] },
      { q: "Dealer city?",       opts: ["Mumbai", "Delhi", "Chennai", "Hyderabad"] },
      { q: "Preferred date?",    opts: ["Today", "Tomorrow", "This Saturday", "This Sunday"] },
      { q: "Time slot?",         opts: ["9–11 AM", "11–1 PM", "2–4 PM", "4–6 PM"] },
      { q: "Your name?",         opts: [], input: true },
      { q: "Mobile number?",     opts: [], input: true },
    ],
    outcome: "CREATE_LEAD",
  },
  {
    key: "service", label: "🛠️ Service & Support", color: "#8b5cf6", bg: "#ede9fe",
    steps: [
      { q: "Service type?",      opts: ["Book Service", "AMC Plans", "Breakdown", "Status"] },
      { q: "Vehicle number?",    opts: [], input: true },
      { q: "Dealer city?",       opts: ["Mumbai", "Delhi", "Chennai", "Hyderabad"] },
      { q: "Preferred date?",    opts: ["Today", "Tomorrow", "This Saturday"] },
    ],
    outcome: "CREATE_TICKET",
  },
  {
    key: "spare_parts", label: "🔧 Spare Parts", color: "#ec4899", bg: "#fce7f3",
    steps: [
      { q: "Select vehicle?",    opts: ["Dost+", "Ecomet 912", "AVTR 4940", "Circuit S"] },
      { q: "Part category?",     opts: ["Engine", "Battery", "Brakes", "Suspension", "Filters"] },
      { q: "Your name?",         opts: [], input: true },
      { q: "Mobile number?",     opts: [], input: true },
    ],
    outcome: "CREATE_LEAD",
  },
  {
    key: "finance", label: "💳 Finance & EMI", color: "#f97316", bg: "#ffedd5",
    steps: [
      { q: "Select vehicle?",    opts: ["Dost+", "Ecomet 912", "AVTR 4940"] },
      { q: "Vehicle price? (₹L)", opts: [], input: true },
      { q: "Down payment? (₹L)", opts: [], input: true },
      { q: "Loan tenure?",       opts: ["12 Months", "24 Months", "36 Months", "48 Months", "60 Months"] },
      { q: "💳 EMI calculation shown", opts: [] },
    ],
    outcome: "NONE",
  },
  {
    key: "find_dealer", label: "📍 Find Dealer", color: "#14b8a6", bg: "#f0fdfa",
    steps: [
      { q: "Your city?",         opts: ["Mumbai", "Delhi", "Chennai", "Bangalore", "Hyderabad"] },
      { q: "📍 Dealer info shown", opts: [] },
    ],
    outcome: "NONE",
  },
  {
    key: "callback", label: "📞 Request Callback", color: "#64748b", bg: "#f1f5f9",
    steps: [
      { q: "Your name?",         opts: [], input: true },
      { q: "Mobile number?",     opts: [], input: true },
      { q: "Preferred time?",    opts: ["9–11 AM", "11–1 PM", "2–4 PM", "4–6 PM", "Anytime"] },
    ],
    outcome: "CREATE_LEAD",
  },
  {
    key: "agent", label: "💬 Chat with Agent", color: "#6366f1", bg: "#ede9fe",
    steps: [
      { q: "Query category?",    opts: ["New Purchase", "Pricing", "Finance", "Fleet", "Service"] },
      { q: "Your name?",         opts: [], input: true },
      { q: "Mobile number?",     opts: [], input: true },
      { q: "Email address?",     opts: [], input: true },
      { q: "Your city?",         opts: ["Mumbai", "Delhi", "Chennai", "Hyderabad"] },
    ],
    outcome: "ASSIGN_AGENT",
  },
];

const OUTCOME_LABELS: Record<string, { label: string; color: string; icon: typeof Tag }> = {
  CREATE_LEAD:   { label: "Lead Created",   color: "text-green-700 bg-green-100 border-green-200",  icon: Tag },
  CREATE_TICKET: { label: "Ticket Created", color: "text-orange-700 bg-orange-100 border-orange-200", icon: Ticket },
  ASSIGN_AGENT:  { label: "Agent Assigned", color: "text-indigo-700 bg-indigo-100 border-indigo-200", icon: UserCheck },
  NONE:          { label: "Back to Menu",   color: "text-gray-600 bg-gray-100 border-gray-200",     icon: ArrowRight },
};

// ── Pixel-perfect widget preview (matches widget.js CSS exactly) ────────────
function WidgetPreview({
  color, theme, welcomeMessage, companyName, screen,
}: {
  color: string; theme: string; welcomeMessage: string; companyName: string; screen: "form" | "chat";
}) {
  const dark = theme === "DARK";
  const BG    = dark ? "#1f2937" : "#ffffff";
  const BG2   = dark ? "#111827" : "#f9fafb";
  const BORD  = dark ? "#374151" : "#e5e7eb";
  const TXT   = dark ? "#f9fafb" : "#111827";
  const MUTED = dark ? "#9ca3af" : "#6b7280";

  const mainMenu = [
    "🚛 Find a Vehicle", "💰 Get On-Road Price", "📄 Download Brochure",
    "🚗 Book Test Drive", "🛠️ Service & Support", "🔧 Spare Parts",
    "💳 Finance & EMI", "📍 Find Dealer", "📞 Request Callback", "💬 Chat with Agent",
  ];

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      background: BG, borderRadius: "18px",
      boxShadow: "0 12px 48px rgba(0,0,0,.2)",
      border: `1px solid ${BORD}`, overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      {/* ── Header (exact widget.js #sf-head) ── */}
      <div style={{
        background: color, padding: "14px 16px",
        display: "flex", alignItems: "center", gap: "10px", flexShrink: 0,
      }}>
        {/* avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(255,255,255,.18)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: "white" }}>
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </div>
        {/* info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {companyName || "Support"}
          </div>
          <div style={{ color: "rgba(255,255,255,.78)", fontSize: 11.5, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block", flexShrink: 0 }} />
            We reply in minutes
          </div>
        </div>
        {/* close button */}
        <button style={{
          background: "none", border: "none", color: "rgba(255,255,255,.8)",
          cursor: "pointer", padding: 5, borderRadius: 6, lineHeight: 0, flexShrink: 0,
        }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Visitor Form (sf-form) ── */}
      {screen === "form" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          justifyContent: "center", alignItems: "center",
          padding: "28px 24px", background: BG2, gap: 18,
        }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: TXT, textAlign: "center", lineHeight: 1.4 }}>
            👋 Welcome!
          </h3>
          <p style={{ fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 1.5 }}>
            Please introduce yourself so we can assist you better.
          </p>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: TXT }}>Your Name *</label>
            <input placeholder="John Doe" style={{
              width: "100%", border: `1.5px solid ${BORD}`, borderRadius: 10,
              padding: "10px 14px", fontSize: 13.5, color: TXT, background: BG, outline: "none",
            }} />
          </div>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: TXT }}>Phone / Email</label>
            <input placeholder="+91 98765 43210" style={{
              width: "100%", border: `1.5px solid ${BORD}`, borderRadius: 10,
              padding: "10px 14px", fontSize: 13.5, color: TXT, background: BG, outline: "none",
            }} />
          </div>
          <button style={{
            width: "100%", padding: 12, background: color, color: "white",
            border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            Start Chatting →
          </button>
        </div>
      )}

      {/* ── Chat View (sf-msgs + sf-opts + sf-foot) ── */}
      {screen === "chat" && (
        <>
          {/* Messages area */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "14px 14px 8px",
            display: "flex", flexDirection: "column", gap: 10,
            background: BG2, minHeight: 140,
          }}>
            {/* Bot welcome bubble */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{
                maxWidth: "85%", padding: "10px 14px",
                borderRadius: "18px 18px 18px 4px",
                fontSize: 13.5, lineHeight: 1.6, wordBreak: "break-word",
                background: BG, color: TXT,
                border: `1px solid ${BORD}`,
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
              }}>
                Hi! 👋 {welcomeMessage}
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 3, paddingLeft: 3 }}>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>

            {/* Bot second message */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{
                maxWidth: "85%", padding: "10px 14px",
                borderRadius: "18px 18px 18px 4px",
                fontSize: 13.5, lineHeight: 1.6,
                background: BG, color: TXT,
                border: `1px solid ${BORD}`,
                boxShadow: "0 1px 4px rgba(0,0,0,.06)",
              }}>
                Please select from the options below:
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 3, paddingLeft: 3 }}>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>

          {/* Quick reply options (sf-opts) */}
          <div style={{
            padding: "10px 14px 12px", background: BG2,
            borderTop: `1px solid ${BORD}`,
            display: "flex", flexDirection: "column", gap: 6, flexShrink: 0,
            maxHeight: 210, overflowY: "auto",
          }}>
            {mainMenu.map((opt) => (
              <button key={opt} style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                border: `1.5px solid ${color}`,
                background: "transparent", color: color,
                fontSize: 13.5, fontWeight: 500, cursor: "pointer",
                textAlign: "left", lineHeight: 1.3,
              }}>
                {opt}
              </button>
            ))}
          </div>

          {/* Footer (sf-foot) */}
          <div style={{
            padding: "10px 12px", borderTop: `1px solid ${BORD}`,
            display: "flex", gap: 8, alignItems: "flex-end",
            background: BG, flexShrink: 0,
          }}>
            <textarea rows={1} placeholder="Type a message…" style={{
              flex: 1, border: `1.5px solid ${BORD}`, borderRadius: 22,
              padding: "10px 16px", fontSize: 13, outline: "none",
              background: BG2, color: TXT, resize: "none", maxHeight: 90, lineHeight: 1.4,
            }} />
            <button style={{
              width: 38, height: 38, flexShrink: 0, borderRadius: "50%",
              background: color, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: "white" }}>
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Powered by footer */}
      <div style={{ textAlign: "center", fontSize: 10, color: MUTED, padding: "4px 0 6px" }}>
        Powered by <span style={{ color }}>SupportFlow</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WidgetBuilderPage() {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [previewScreen, setPreviewScreen] = useState<"form" | "chat">("chat");
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    theme: "LIGHT" as "LIGHT" | "DARK",
    primaryColor: "#6366f1",
    position: "BOTTOM_RIGHT" as "BOTTOM_RIGHT" | "BOTTOM_LEFT",
    welcomeMessage: "Hi! How can we help you today?",
    offlineMessage: "We're offline. Leave a message!",
    showAgentAvatar: true,
    showAgentName: true,
  });

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

  const saveMutation = useMutation({
    mutationFn: async (data: typeof settings) => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widget: data }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Widget settings saved" });
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    },
  });

  const widgetKey = apiKeys?.[0]?.key || "YOUR_API_KEY";
  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

  const snippetCode = `<!-- SupportFlow Widget -->
<script>
  window.SupportFlowConfig = {
    apiKey: "${widgetKey}",
    theme: "${settings.theme.toLowerCase()}",
    position: "${settings.position.toLowerCase().replace("_", "-")}",
    primaryColor: "${settings.primaryColor}",
    welcomeMessage: "${settings.welcomeMessage}",
  };
</script>
<script src="${appUrl}/widget.js" async></script>`;

  const copySnippet = () => {
    navigator.clipboard.writeText(snippetCode);
    setCopied(true);
    toast({ title: "Code copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Widget Builder</h1>
        <p className="text-gray-500 text-sm mt-1">Customize, preview and deploy your chat widget</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ── Left: Settings Tabs ──────────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-4">
          <Tabs defaultValue="appearance">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="appearance" className="text-xs"><Palette className="w-3.5 h-3.5 mr-1" />Appearance</TabsTrigger>
              <TabsTrigger value="content"    className="text-xs"><MessageSquare className="w-3.5 h-3.5 mr-1" />Content</TabsTrigger>
              <TabsTrigger value="flow"       className="text-xs"><GitBranch className="w-3.5 h-3.5 mr-1" />Chat Flow</TabsTrigger>
              <TabsTrigger value="install"    className="text-xs"><Code className="w-3.5 h-3.5 mr-1" />Install</TabsTrigger>
            </TabsList>

            {/* ── Appearance ── */}
            <TabsContent value="appearance" className="space-y-4 mt-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 space-y-5">
                  {/* Theme */}
                  <div>
                    <label className="text-sm font-medium">Theme</label>
                    <div className="flex gap-3 mt-2">
                      {(["LIGHT", "DARK"] as const).map((t) => (
                        <button key={t} onClick={() => setSettings({ ...settings, theme: t })}
                          className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            settings.theme === t
                              ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm"
                              : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}>
                          {t === "LIGHT" ? "☀️ Light" : "🌙 Dark"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Primary Color */}
                  <div>
                    <label className="text-sm font-medium">Primary Color</label>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <input type="color" value={settings.primaryColor}
                        onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                        className="h-10 w-14 rounded-lg cursor-pointer border p-0.5" />
                      <Input value={settings.primaryColor}
                        onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                        className="w-32 font-mono text-sm" />
                      <div className="flex gap-2">
                        {["#6366f1", "#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#ec4899", "#0ea5e9"].map((c) => (
                          <button key={c} onClick={() => setSettings({ ...settings, primaryColor: c })}
                            className={`w-7 h-7 rounded-full border-2 shadow transition-transform hover:scale-110 ${settings.primaryColor === c ? "border-gray-700 scale-110" : "border-white"}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Position */}
                  <div>
                    <label className="text-sm font-medium">Widget Position</label>
                    <div className="flex gap-3 mt-2">
                      {(["BOTTOM_RIGHT", "BOTTOM_LEFT"] as const).map((pos) => (
                        <button key={pos} onClick={() => setSettings({ ...settings, position: pos })}
                          className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            settings.position === pos
                              ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm"
                              : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}>
                          {pos === "BOTTOM_RIGHT" ? "↘ Bottom Right" : "↙ Bottom Left"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Show Avatar toggle */}
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
            </TabsContent>

            {/* ── Content ── */}
            <TabsContent value="content" className="space-y-4 mt-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium">Welcome Message</label>
                    <p className="text-xs text-gray-400 mt-0.5 mb-1">Shown as the first message when chat opens</p>
                    <Input value={settings.welcomeMessage}
                      onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                      className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Offline Message</label>
                    <p className="text-xs text-gray-400 mt-0.5 mb-1">Shown when no agents are available</p>
                    <Input value={settings.offlineMessage}
                      onChange={(e) => setSettings({ ...settings, offlineMessage: e.target.value })}
                      className="mt-1" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Chat Flow ── */}
            <TabsContent value="flow" className="mt-4">
              <div className="space-y-4">
                {/* Start node */}
                <div className="flex flex-col items-center gap-0">
                  <div className="bg-indigo-600 text-white rounded-2xl px-6 py-3 text-sm font-semibold shadow-md w-full max-w-sm text-center">
                    🟢 Chat Starts
                    <p className="text-indigo-200 text-xs font-normal mt-0.5">Visitor fills name + phone</p>
                  </div>
                  <div className="w-0.5 h-5 bg-gray-300" />
                  <div className="bg-gray-100 border border-gray-200 rounded-2xl px-6 py-3 text-sm font-medium shadow-sm w-full max-w-sm text-center text-gray-700">
                    👋 {settings.welcomeMessage}
                    <p className="text-gray-400 text-xs font-normal mt-0.5">Bot welcome message</p>
                  </div>
                  <div className="w-0.5 h-5 bg-gray-300" />
                  <div className="bg-white border-2 border-indigo-200 rounded-2xl px-6 py-3 text-sm font-semibold shadow-sm w-full max-w-sm text-center text-indigo-700">
                    📋 Main Menu — Choose an option
                  </div>
                  <div className="w-0.5 h-5 bg-gray-300" />
                </div>

                {/* Flow cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FLOWS.map((flow) => {
                    const isOpen = expandedFlow === flow.key;
                    const outcome = OUTCOME_LABELS[flow.outcome];
                    const OutcomeIcon = outcome.icon;
                    return (
                      <div key={flow.key}
                        className="rounded-2xl border overflow-hidden shadow-sm transition-shadow hover:shadow-md"
                        style={{ borderColor: flow.color + "44" }}>
                        {/* Card header */}
                        <button
                          onClick={() => setExpandedFlow(isOpen ? null : flow.key)}
                          className="w-full flex items-center justify-between p-3 text-left transition-colors"
                          style={{ backgroundColor: flow.bg }}>
                          <span className="font-semibold text-sm" style={{ color: flow.color }}>
                            {flow.label}
                          </span>
                          {isOpen
                            ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: flow.color }} />
                            : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: flow.color }} />}
                        </button>

                        {/* Expanded steps */}
                        {isOpen && (
                          <div className="bg-white p-3 space-y-2 border-t" style={{ borderColor: flow.color + "22" }}>
                            {flow.steps.map((step, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                                  style={{ backgroundColor: flow.color }}>
                                  {i + 1}
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-gray-700">{step.q}</p>
                                  {step.opts.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {step.opts.map((o) => (
                                        <span key={o} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                          {o}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {step.input && (
                                    <span className="text-[10px] text-gray-400 italic">✏️ Free text input</span>
                                  )}
                                </div>
                              </div>
                            ))}
                            {/* Outcome */}
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

                <p className="text-xs text-gray-400 text-center pt-2">
                  Click any flow card to see its steps • Flow logic is in <code className="bg-gray-100 px-1 rounded">src/lib/chatbot-flow.ts</code>
                </p>
              </div>
            </TabsContent>

            {/* ── Install ── */}
            <TabsContent value="install" className="mt-4">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Installation Code</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Add this snippet to your website&apos;s HTML just before the closing{" "}
                    <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> tag.
                  </p>
                  <div className="relative bg-gray-900 rounded-xl overflow-hidden">
                    <pre className="text-green-400 text-xs p-4 overflow-x-auto font-mono leading-relaxed">
                      {snippetCode}
                    </pre>
                    <Button size="sm" onClick={copySnippet}
                      className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 h-7 gap-1">
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                    <p className="font-semibold mb-1">Your API Key</p>
                    <code className="font-mono text-xs bg-blue-100 px-2 py-1 rounded">{widgetKey}</code>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700">
            {saveMutation.isPending ? "Saving…" : "Save Settings"}
          </Button>
        </div>

        {/* ── Right: Pixel-perfect widget preview ─────────────────────────── */}
        <div className="xl:col-span-2">
          <div className="sticky top-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-500" /> Live Preview
              </p>
              {/* Screen toggle */}
              <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
                <button onClick={() => setPreviewScreen("form")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${previewScreen === "form" ? "bg-white shadow text-gray-800" : "text-gray-500"}`}>
                  Visitor Form
                </button>
                <button onClick={() => setPreviewScreen("chat")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${previewScreen === "chat" ? "bg-white shadow text-gray-800" : "text-gray-500"}`}>
                  Chat View
                </button>
              </div>
            </div>

            <WidgetPreview
              color={settings.primaryColor}
              theme={settings.theme}
              welcomeMessage={settings.welcomeMessage}
              companyName={companyData?.name || "Support"}
              screen={previewScreen}
            />

            <p className="text-center text-xs text-gray-400">
              Preview matches your live widget exactly
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
