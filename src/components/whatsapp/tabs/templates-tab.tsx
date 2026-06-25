"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Plus, Trash2, Loader2, FileText, Zap, RefreshCw } from "lucide-react";
import { EmptyState, PageLoading } from "@/components/whatsapp/empty-state";

interface Template {
  id?: string;
  name: string;
  status: string;
  language: string;
  category: string;
  bodyText?: string;
  bodyParamCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-700",
  IN_APPEAL: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  DISABLED: "bg-gray-100 text-gray-500",
  PAUSED: "bg-orange-100 text-orange-700",
  LIMIT_EXCEEDED: "bg-red-100 text-red-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utility",
  AUTHENTICATION: "Authentication",
};

// Preset templates for quick creation
const PRESETS = [
  {
    label: "Promotional Offer",
    category: "MARKETING" as const,
    name: "promotional_offer",
    bodyText: "Hi {{1}}! 🎉 Exclusive offer just for you — {{2}}. Valid till {{3}}. Don't miss out!",
    footer: "Reply STOP to unsubscribe",
  },
  {
    label: "Order Confirmation",
    category: "UTILITY" as const,
    name: "order_confirmation",
    bodyText: "Hi {{1}}, your order #{{2}} has been confirmed. Expected delivery: {{3}}. Thank you for shopping with us!",
    footer: "Contact us for any queries",
  },
  {
    label: "Appointment Reminder",
    category: "UTILITY" as const,
    name: "appointment_reminder",
    bodyText: "Hi {{1}}, this is a reminder for your appointment on {{2}} at {{3}}. Please reply YES to confirm or NO to reschedule.",
    footer: "",
  },
  {
    label: "Welcome Message",
    category: "UTILITY" as const,
    name: "welcome_message",
    bodyText: "Welcome to {{1}}, {{2}}! 👋 We're excited to have you on board. Our team is here to help you anytime.",
    footer: "Reply HELP for assistance",
  },
  {
    label: "Service Update",
    category: "UTILITY" as const,
    name: "service_update",
    bodyText: "Hi {{1}}, your {{2}} service request has been updated. Status: {{3}}. Our team will contact you shortly.",
    footer: "",
  },
  {
    label: "Test Drive Booking",
    category: "UTILITY" as const,
    name: "test_drive_confirmation",
    bodyText: "Hi {{1}}, your test drive for {{2}} is confirmed on {{3}}. Our executive will be in touch. We look forward to seeing you!",
    footer: "Audi Hyderabad | 99597 00007",
  },
  {
    label: "New Arrival Alert",
    category: "MARKETING" as const,
    name: "new_arrival_alert",
    bodyText: "Hi {{1}}, exciting news! 🚀 The all-new {{2}} has arrived. Be among the first to experience it. Book your slot now!",
    footer: "Reply STOP to opt out",
  },
  {
    label: "Payment Reminder",
    category: "UTILITY" as const,
    name: "payment_reminder",
    bodyText: "Hi {{1}}, your EMI of ₹{{2}} is due on {{3}}. Please ensure timely payment to avoid any charges. Thank you.",
    footer: "",
  },
];

interface TemplateForm {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  headerText: string;
  bodyText: string;
  footerText: string;
  hasHeader: boolean;
  hasFooter: boolean;
}

const defaultForm = (): TemplateForm => ({
  name: "",
  category: "UTILITY",
  language: "en",
  headerText: "",
  bodyText: "",
  footerText: "",
  hasHeader: false,
  hasFooter: false,
});

function buildComponents(form: TemplateForm) {
  const components = [];
  if (form.hasHeader && form.headerText.trim()) {
    components.push({ type: "HEADER" as const, format: "TEXT" as const, text: form.headerText.trim() });
  }
  if (form.bodyText.trim()) {
    components.push({ type: "BODY" as const, text: form.bodyText.trim() });
  }
  if (form.hasFooter && form.footerText.trim()) {
    components.push({ type: "FOOTER" as const, text: form.footerText.trim() });
  }
  return components;
}

export function TemplatesTab() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<TemplateForm>(defaultForm());

  const { data: templates, isLoading, refetch, isFetching } = useQuery<Template[]>({
    queryKey: ["whatsapp-templates-all"],
    queryFn: () => axios.get("/api/whatsapp/templates?approvedOnly=false").then((r) => r.data.data),
  });

  const set = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setForm({
      ...defaultForm(),
      name: preset.name,
      category: preset.category,
      language: "en",
      bodyText: preset.bodyText,
      footerText: preset.footer,
      hasFooter: !!preset.footer,
      hasHeader: false,
      headerText: "",
    });
    setShowCreate(true);
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const components = buildComponents(form);
      if (!components.some((c) => c.type === "BODY")) throw new Error("Body text is required");
      return axios.post("/api/whatsapp/templates", {
        name: form.name.toLowerCase().replace(/\s+/g, "_"),
        category: form.category,
        language: form.language,
        components,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-templates-all"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast({ title: `Template "${res.data.data.name}" submitted — status: ${res.data.data.status}` });
      setShowCreate(false);
      setForm(defaultForm());
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : err instanceof Error ? err.message : "Failed to create template";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => axios.delete("/api/whatsapp/templates", { data: { name } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-templates-all"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to delete";
      toast({ title: msg, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Message Templates</h1>
          <p className="text-muted-foreground text-sm">Templates must be approved by Meta before use in campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />New Template
          </Button>
        </div>
      </div>

      {/* Quick-start presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Quick Presets — click to create
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.name} variant="outline" size="sm" className="text-xs" onClick={() => applyPreset(p)}>
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Template list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <PageLoading />
          ) : !templates?.length ? (
            <EmptyState
              icon={FileText}
              title="No templates yet"
              description="Create a template above or click a preset to get started. Templates take a few minutes to be reviewed by Meta."
            />
          ) : (
            <div className="divide-y">
              {templates.map((t) => (
                <div key={t.name + t.language} className="px-4 py-3 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium font-mono">{t.name}</span>
                      <Badge className={STATUS_COLORS[t.status] || "bg-gray-100 text-gray-600"}>{t.status}</Badge>
                      <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[t.category] || t.category}</Badge>
                      <span className="text-xs text-muted-foreground">{t.language.toUpperCase()}</span>
                    </div>
                    {t.bodyText && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.bodyText}</p>
                    )}
                    {t.bodyParamCount > 0 && (
                      <p className="text-xs text-blue-600 mt-0.5">{t.bodyParamCount} variable{t.bodyParamCount > 1 ? "s" : ""} ({Array.from({ length: t.bodyParamCount }, (_, i) => `{{${i + 1}}}`).join(", ")})</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive shrink-0"
                    onClick={() => deleteMutation.mutate(t.name)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Message Template</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Template Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                  placeholder="my_template_name"
                />
                <p className="text-xs text-muted-foreground">Lowercase, underscores only</p>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => set("category", v as TemplateForm["category"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={form.language} onValueChange={(v) => set("language", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="en_US">English (US)</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="te">Telugu</SelectItem>
                  <SelectItem value="ta">Tamil</SelectItem>
                  <SelectItem value="kn">Kannada</SelectItem>
                  <SelectItem value="mr">Marathi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasHeader"
                  checked={form.hasHeader}
                  onChange={(e) => set("hasHeader", e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="hasHeader" className="cursor-pointer">Add Header (optional)</Label>
              </div>
              {form.hasHeader && (
                <Input value={form.headerText} onChange={(e) => set("headerText", e.target.value)} placeholder="Header text (max 60 chars)" maxLength={60} />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Body Text <span className="text-red-500">*</span></Label>
              <Textarea
                value={form.bodyText}
                onChange={(e) => set("bodyText", e.target.value)}
                placeholder={"Hi {{1}}, your order {{2}} is confirmed. Thank you!"}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{1}}, {{2}}, {{3}}…"} for dynamic variables filled at send time.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasFooter"
                  checked={form.hasFooter}
                  onChange={(e) => set("hasFooter", e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="hasFooter" className="cursor-pointer">Add Footer (optional)</Label>
              </div>
              {form.hasFooter && (
                <Input value={form.footerText} onChange={(e) => set("footerText", e.target.value)} placeholder="Footer text (max 60 chars)" maxLength={60} />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.bodyText || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit for Approval
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
