"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2, IndianRupee, TrendingUp,
  Plus, Search, Ban, CheckCircle, Trash2, Globe, Wallet, Loader2,
  MessageSquare, ChevronDown, ChevronUp, Pencil, Star, Layers,
} from "lucide-react";
import axios from "axios";
import { timeAgo, formatNumber } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type Company = {
  _id: string; name: string; email: string; slug: string;
  isActive: boolean; isSuspended: boolean; suspendReason?: string;
  planId?: { _id: string; type: string; name: string };
  createdAt: string; trialEndsAt?: string;
};

type PlanLimits = {
  agents: number; chats: number; aiMessages: number; storage: number;
  knowledgeFiles: number; workflows: number; apiRequests: number;
  departments: number; chatbots: number; leads: number; tickets: number;
};

type Plan = {
  _id: string; name: string; type: "STARTER" | "PRO" | "ENTERPRISE";
  description: string; price: { monthly: number; annually: number };
  currency: string; limits: PlanLimits;
  isActive: boolean; isPopular: boolean; sortOrder: number;
  companyCount: number;
};

type Revenue = {
  currency: string;
  stats: { mrr: number; totalRevenue: number; activeSubscriptions: number };
  revenueByPlan: { plan: string; revenue: number }[];
  monthlyTrend: { month: string; mrr: number }[];
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createCompanySchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  adminName: z.string().min(2),
  adminEmail: z.email(),
  adminPassword: z.string().min(8),
  planType: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
  whatsapp: z.object({
    businessAccountId: z.string().optional(),
    phoneNumberId: z.string().optional(),
    displayPhoneNumber: z.string().optional(),
    accessToken: z.string().optional(),
    webhookVerifyToken: z.string().optional(),
  }).optional(),
});
type CreateCompanyForm = z.infer<typeof createCompanySchema>;

const lim = z.number().int().min(-1);
const planEditSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.object({ monthly: z.number().int().min(0), annually: z.number().int().min(0) }),
  limits: z.object({
    agents: lim, chats: lim, aiMessages: lim, storage: lim,
    knowledgeFiles: lim, workflows: lim, apiRequests: lim,
    departments: lim, chatbots: lim, leads: lim, tickets: lim,
  }),
  isActive: z.boolean(),
  isPopular: z.boolean(),
});
type PlanEditForm = z.infer<typeof planEditSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLAN_STYLE: Record<string, { badge: string; border: string; icon: string }> = {
  STARTER:    { badge: "bg-blue-100 text-blue-700",   border: "border-blue-200",   icon: "text-blue-500"   },
  PRO:        { badge: "bg-indigo-100 text-indigo-700", border: "border-indigo-200", icon: "text-indigo-500" },
  ENTERPRISE: { badge: "bg-purple-100 text-purple-700", border: "border-purple-200", icon: "text-purple-500" },
};

const STATUS_FILTERS = [
  { key: "all",       label: "All" },
  { key: "active",    label: "Active" },
  { key: "inactive",  label: "Inactive" },
  { key: "suspended", label: "Suspended" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

const fmt = (n: number) => n === -1 ? "∞" : n.toLocaleString("en-IN");
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ─── Component ───────────────────────────────────────────────────────────────

export function SuperAdminDashboard() {
  const qc = useQueryClient();

  // Tab
  const [tab, setTab] = useState<"companies" | "plans" | "revenue">("companies");

  // Companies tab state
  const [showCreate, setShowCreate] = useState(false);
  const [setupWhatsApp, setSetupWhatsApp] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [suspendModal, setSuspendModal] = useState<{ id: string; name: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [creditsModal, setCreditsModal] = useState<{ id: string; name: string } | null>(null);
  const [creditsAmount, setCreditsAmount] = useState("1000");

  // Plans tab state
  const [editPlan, setEditPlan] = useState<Plan | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const companiesQuery = useQuery({
    queryKey: ["admin-companies", search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/companies?${params}`);
      return res.json() as Promise<{ data: Company[]; pagination: { total: number } }>;
    },
  });

  const plansQuery = useQuery<Plan[]>({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const res = await fetch("/api/admin/plans");
      const d = await res.json();
      return d.data;
    },
    enabled: tab === "plans",
  });

  const revenueQuery = useQuery<Revenue>({
    queryKey: ["admin-revenue"],
    queryFn: async () => {
      const res = await fetch("/api/admin/revenue");
      const d = await res.json();
      return d.data;
    },
    enabled: tab === "revenue",
  });

  // ── Company form ─────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateCompanyForm>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: { planType: "STARTER" },
  });

  // ── Plan edit form ────────────────────────────────────────────────────────
  const planForm = useForm<PlanEditForm>({ resolver: zodResolver(planEditSchema) });

  const openPlanEdit = (plan: Plan) => {
    setEditPlan(plan);
    planForm.reset({
      name: plan.name,
      price: { monthly: plan.price.monthly, annually: plan.price.annually },
      limits: { ...plan.limits },
      isActive: plan.isActive,
      isPopular: plan.isPopular,
    });
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: CreateCompanyForm) => {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (res) => {
      if (res.success) {
        toast({ title: res.data?.whatsappConnected ? "Company created with WhatsApp connected" : "Company created successfully" });
        reset(); setSetupWhatsApp(false); setShowCreate(false);
        qc.invalidateQueries({ queryKey: ["admin-companies"] });
      } else {
        toast({ title: res.error, variant: "destructive" });
      }
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      return res.json();
    },
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: ["admin-companies", search, statusFilter] });
      const previous = qc.getQueryData(["admin-companies", search, statusFilter]);
      qc.setQueryData(["admin-companies", search, statusFilter], (old: { data: Company[]; pagination: { total: number } } | undefined) => {
        if (!old) return old;
        return { ...old, data: old.data.map((c) => c._id === id ? { ...c, isActive } : c) };
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(["admin-companies", search, statusFilter], ctx.previous);
      toast({ title: "Failed to update status", variant: "destructive" });
    },
    onSuccess: (res, { isActive }) => {
      if (!res.success) { toast({ title: res.error, variant: "destructive" }); qc.invalidateQueries({ queryKey: ["admin-companies"] }); return; }
      toast({ title: isActive ? "Company activated" : "Company deactivated" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-companies"] }),
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/companies/${id}/suspend`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Company suspended" });
      setSuspendModal(null); setSuspendReason("");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${id}/suspend`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => { toast({ title: "Company unsuspended" }); qc.invalidateQueries({ queryKey: ["admin-companies"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/companies/${id}`, { method: "DELETE" }); },
    onSuccess: () => { toast({ title: "Company deleted" }); qc.invalidateQueries({ queryKey: ["admin-companies"] }); },
  });

  const addCreditsMutation = useMutation({
    mutationFn: ({ companyId, amount }: { companyId: string; amount: number }) =>
      axios.post("/api/whatsapp/wallet/add-credits", { companyId, amount }),
    onSuccess: () => { toast({ title: "WhatsApp credits added" }); setCreditsModal(null); setCreditsAmount("1000"); },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to add credits";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PlanEditForm }) => {
      const res = await fetch(`/api/plans/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (res) => {
      if (res.success) {
        toast({ title: "Plan updated successfully" });
        setEditPlan(null);
        qc.invalidateQueries({ queryKey: ["admin-plans"] });
      } else {
        toast({ title: res.error, variant: "destructive" });
      }
    },
  });

  // ── Derived state ─────────────────────────────────────────────────────────
  const companies = companiesQuery.data?.data || [];
  const total = companiesQuery.data?.pagination?.total || 0;
  const activeCount = companies.filter((c) => c.isActive && !c.isSuspended).length;
  const suspendedCount = companies.filter((c) => c.isSuspended).length;

  const cardBorder = (c: Company) =>
    c.isSuspended ? "border-l-4 border-l-red-400" : c.isActive ? "border-l-4 border-l-green-400" : "border-l-4 border-l-gray-300";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Super Admin</h1>
        <p className="text-gray-500 text-sm mt-1">Platform overview and management</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Building2,   label: "Total Companies",  value: total,         color: "text-blue-600",   bg: "bg-blue-50"   },
          { icon: CheckCircle, label: "Active Companies",  value: activeCount,   color: "text-green-600",  bg: "bg-green-50"  },
          { icon: Ban,         label: "Suspended",         value: suspendedCount,color: "text-red-600",    bg: "bg-red-50"    },
          { icon: IndianRupee, label: "Est. MRR",          value: `₹${(total * 8299).toLocaleString("en-IN")}`, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className="text-2xl font-bold">
                  {typeof card.value === "number" ? formatNumber(card.value) : card.value}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 gap-1">
        {(["companies", "plans", "revenue"] as const).map((t) => {
          const icons = { companies: Building2, plans: Layers, revenue: TrendingUp };
          const Icon = icons[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          );
        })}
      </div>

      {/* ══════════════ COMPANIES TAB ══════════════ */}
      {tab === "companies" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search companies…" className="pl-9 w-60" />
              </div>
              {/* Status filter chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      statusFilter === f.key
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
              <Plus className="w-4 h-4 mr-2" /> Create Company
            </Button>
          </div>

          {/* Company cards */}
          <div className="space-y-2">
            {companiesQuery.isLoading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-xl animate-pulse border" />
            ))}

            {companies.map((company) => {
              const isToggling =
                toggleActiveMutation.isPending &&
                (toggleActiveMutation.variables as { id: string } | undefined)?.id === company._id;

              return (
                <Card key={company._id} className={`border-0 shadow-sm transition-all ${cardBorder(company)}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        company.isSuspended ? "bg-red-100" : company.isActive ? "bg-indigo-100" : "bg-gray-100"
                      }`}>
                        <Globe className={`w-5 h-5 ${company.isSuspended ? "text-red-500" : company.isActive ? "text-indigo-600" : "text-gray-400"}`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{company.name}</p>
                          {company.isSuspended && <Badge variant="destructive" className="text-xs">Suspended</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                          <span>{company.email}</span>
                          <span>{timeAgo(company.createdAt)}</span>
                          {company.trialEndsAt && new Date(company.trialEndsAt) > new Date() && (
                            <span className="text-yellow-600">Trial ends {new Date(company.trialEndsAt).toLocaleDateString("en-IN")}</span>
                          )}
                        </div>
                        {company.isSuspended && company.suspendReason && (
                          <p className="text-xs text-red-500 mt-1">Reason: {company.suspendReason}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {company.planId && (
                          <Badge variant="outline" className={`text-xs ${PLAN_STYLE[company.planId.type]?.badge || ""}`}>
                            {company.planId.name}
                          </Badge>
                        )}

                        {/* Active toggle */}
                        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-colors ${
                          company.isActive ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                        }`}>
                          <span className={`text-xs font-medium w-14 text-right ${company.isActive ? "text-green-700" : "text-gray-400"}`}>
                            {isToggling ? "…" : company.isActive ? "Active" : "Inactive"}
                          </span>
                          <Switch
                            checked={company.isActive}
                            disabled={isToggling || company.isSuspended}
                            onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: company._id, isActive: checked })}
                            title={company.isSuspended ? "Restore company before activating" : undefined}
                          />
                        </div>

                        <Button variant="outline" size="sm" className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => setCreditsModal({ id: company._id, name: company.name })}>
                          <Wallet className="w-3 h-3 mr-1" /> Credits
                        </Button>

                        {!company.isSuspended ? (
                          <Button variant="outline" size="sm" className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                            onClick={() => setSuspendModal({ id: company._id, name: company.name })}>
                            <Ban className="w-3 h-3 mr-1" /> Suspend
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                            disabled={unsuspendMutation.isPending}
                            onClick={() => unsuspendMutation.mutate(company._id)}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Restore
                          </Button>
                        )}

                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(company._id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {!companiesQuery.isLoading && companies.length === 0 && (
              <div className="text-center py-16 text-gray-400 text-sm">
                No companies found{search ? ` matching "${search}"` : ""}
                {statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ PLANS TAB ══════════════ */}
      {tab === "plans" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Use -1 in any limit field to set it as unlimited (∞).</p>

          {plansQuery.isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-white rounded-xl animate-pulse border" />)}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(plansQuery.data || []).map((plan) => {
              const style = PLAN_STYLE[plan.type] || PLAN_STYLE.STARTER;
              return (
                <Card key={plan._id} className={`border shadow-sm relative ${style.border}`}>
                  {plan.isPopular && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-yellow-400 text-yellow-900 text-xs gap-1">
                        <Star className="w-3 h-3" /> Popular
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-5 space-y-4">
                    {/* Header */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{plan.type}</span>
                        {!plan.isActive && <Badge variant="outline" className="text-xs text-gray-400">Inactive</Badge>}
                      </div>
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{plan.description}</p>
                    </div>

                    {/* Pricing */}
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">{inr(plan.price.monthly)}</span>
                        <span className="text-xs text-gray-400">/month</span>
                      </div>
                      <p className="text-xs text-gray-400">{inr(plan.price.annually)}/year · saves {inr(plan.price.monthly * 12 - plan.price.annually)}</p>
                    </div>

                    {/* Company count */}
                    <div className="flex items-center justify-between text-sm border rounded-lg px-3 py-2 bg-gray-50">
                      <span className="text-gray-500 text-xs">Companies on this plan</span>
                      <span className="font-bold text-gray-800">{plan.companyCount}</span>
                    </div>

                    {/* Key limits */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {[
                        ["Agents",      plan.limits.agents],
                        ["Chats/mo",    plan.limits.chats],
                        ["AI Messages", plan.limits.aiMessages],
                        ["Chatbots",    plan.limits.chatbots],
                        ["Departments", plan.limits.departments],
                        ["Storage MB",  plan.limits.storage],
                      ].map(([label, val]) => (
                        <div key={String(label)} className="flex items-center justify-between gap-2">
                          <span className="text-gray-400">{label}</span>
                          <span className={`font-semibold ${val === -1 ? "text-indigo-500" : "text-gray-700"}`}>{fmt(val as number)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Edit button */}
                    <Button variant="outline" size="sm" className="w-full gap-1.5 mt-1" onClick={() => openPlanEdit(plan)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit Plan
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════ REVENUE TAB ══════════════ */}
      {tab === "revenue" && (
        <div className="space-y-4">
          {revenueQuery.isLoading && (
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-white rounded-xl animate-pulse border" />)}
            </div>
          )}

          {revenueQuery.data && (
            <>
              {/* Revenue stat cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Monthly Recurring Revenue", value: inr(revenueQuery.data.stats.mrr), icon: IndianRupee, color: "text-green-600", bg: "bg-green-50" },
                  { label: "Annual Revenue Run Rate",   value: inr(revenueQuery.data.stats.totalRevenue), icon: TrendingUp, color: "text-indigo-600", bg: "bg-indigo-50" },
                  { label: "Active Subscriptions",      value: formatNumber(revenueQuery.data.stats.activeSubscriptions), icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-50" },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <Card key={card.label} className="border-0 shadow-sm">
                      <CardContent className="p-5 flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-5 h-5 ${card.color}`} />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{card.value}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{card.label}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Revenue by plan */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold mb-3">Revenue by Plan</h3>
                    <div className="space-y-3">
                      {revenueQuery.data.revenueByPlan.map(({ plan, revenue }) => {
                        const total = revenueQuery.data.revenueByPlan.reduce((s, r) => s + r.revenue, 0);
                        const pct = total > 0 ? Math.round((revenue / total) * 100) : 0;
                        return (
                          <div key={plan}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-medium text-gray-700">{plan}</span>
                              <span className="text-gray-500">{inr(revenue)} · {pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {revenueQuery.data.revenueByPlan.every((r) => r.revenue === 0) && (
                        <p className="text-xs text-gray-400 text-center py-4">No active subscriptions yet.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly trend */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold mb-3">MRR Trend (6 months)</h3>
                    <div className="space-y-2">
                      {revenueQuery.data.monthlyTrend.map(({ month, mrr: mrrVal }) => {
                        const max = Math.max(...revenueQuery.data!.monthlyTrend.map((t) => t.mrr), 1);
                        const pct = Math.round((mrrVal / max) * 100);
                        return (
                          <div key={month} className="flex items-center gap-3 text-xs">
                            <span className="w-14 text-gray-400 shrink-0">{month}</span>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-24 text-right font-medium text-gray-700">{inr(mrrVal)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════ DIALOGS ══════════ */}

      {/* Create Company */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) { setSetupWhatsApp(false); reset(); } }}>
        <DialogContent className="max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create New Company</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d: CreateCompanyForm) => {
            const wa = d.whatsapp;
            const waFilled = setupWhatsApp && wa?.businessAccountId && wa?.phoneNumberId && wa?.accessToken && wa?.webhookVerifyToken;
            if (waFilled) {
              createMutation.mutate(d);
            } else {
              createMutation.mutate({ ...d, whatsapp: undefined });
            }
          })} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Company Name *</label>
                <Input {...register("name")} className="mt-1" />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Company Email *</label>
                <Input {...register("email")} type="email" className="mt-1" />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Admin Name *</label>
                <Input {...register("adminName")} className="mt-1" />
                {errors.adminName && <p className="text-xs text-red-500 mt-1">{errors.adminName.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Admin Email *</label>
                <Input {...register("adminEmail")} type="email" className="mt-1" />
                {errors.adminEmail && <p className="text-xs text-red-500 mt-1">{errors.adminEmail.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Admin Password *</label>
                <Input {...register("adminPassword")} type="password" className="mt-1" />
                {errors.adminPassword && <p className="text-xs text-red-500 mt-1">{errors.adminPassword.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Plan</label>
                <select {...register("planType")} className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                  <option value="STARTER">Starter</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <button type="button" onClick={() => setSetupWhatsApp((p) => !p)}
                className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 transition-colors text-sm font-medium text-green-800">
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Setup WhatsApp Integration
                  <span className="text-xs font-normal text-green-600">(optional)</span>
                </span>
                {setupWhatsApp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {setupWhatsApp && (
                <div className="p-4 grid grid-cols-2 gap-3 border-t bg-white">
                  <p className="col-span-2 text-xs text-gray-500">
                    All fields below are only required if you want to connect WhatsApp now. You can skip this and configure it later in WhatsApp → Settings.
                  </p>
                  <div className="col-span-2">
                    <label className="text-sm font-medium">Business Account ID</label>
                    <Input {...register("whatsapp.businessAccountId")} placeholder="e.g. 123456789012345" className="mt-1 font-mono text-xs" />
                    {errors.whatsapp?.businessAccountId && <p className="text-xs text-red-500 mt-1">{errors.whatsapp.businessAccountId.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Phone Number ID</label>
                    <Input {...register("whatsapp.phoneNumberId")} placeholder="e.g. 987654321098765" className="mt-1 font-mono text-xs" />
                    {errors.whatsapp?.phoneNumberId && <p className="text-xs text-red-500 mt-1">{errors.whatsapp.phoneNumberId.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Display Phone Number</label>
                    <Input {...register("whatsapp.displayPhoneNumber")} placeholder="+91 98765 43210" className="mt-1" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium">Access Token</label>
                    <Input {...register("whatsapp.accessToken")} type="password" placeholder="EAAxxxxxxx…" className="mt-1 font-mono text-xs" />
                    {errors.whatsapp?.accessToken && <p className="text-xs text-red-500 mt-1">{errors.whatsapp.accessToken.message}</p>}
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium">Webhook Verify Token</label>
                    <Input {...register("whatsapp.webhookVerifyToken")} placeholder="Any secret string" className="mt-1" />
                    {errors.whatsapp?.webhookVerifyToken && <p className="text-xs text-red-500 mt-1">{errors.whatsapp.webhookVerifyToken.message}</p>}
                  </div>
                  <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                    🔒 Tokens are encrypted before storage. Company admin can update them anytime in WhatsApp → Settings.
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setSetupWhatsApp(false); reset(); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                {createMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Creating…</> : "Create Company"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Plan */}
      <Dialog open={!!editPlan} onOpenChange={(open) => !open && setEditPlan(null)}>
        <DialogContent className="max-w-xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Plan — {editPlan?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={planForm.handleSubmit((d) => editPlan && updatePlanMutation.mutate({ id: editPlan._id, data: d }))} className="space-y-5">
            {/* Name */}
            <div>
              <label className="text-sm font-medium">Plan Name</label>
              <Input {...planForm.register("name")} className="mt-1" />
            </div>

            {/* Pricing */}
            <div>
              <p className="text-sm font-semibold mb-2">Pricing (₹ INR)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Monthly price</label>
                  <Input type="number" {...planForm.register("price.monthly", { valueAsNumber: true })} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Annual price</label>
                  <Input type="number" {...planForm.register("price.annually", { valueAsNumber: true })} className="mt-1" />
                </div>
              </div>
            </div>

            {/* Limits */}
            <div>
              <p className="text-sm font-semibold mb-1">Limits <span className="text-xs font-normal text-gray-400">(-1 = unlimited)</span></p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ["agents",        "Agents"],
                  ["chats",         "Chats / month"],
                  ["aiMessages",    "AI Messages"],
                  ["storage",       "Storage (MB)"],
                  ["knowledgeFiles","Knowledge Files"],
                  ["workflows",     "Workflows"],
                  ["apiRequests",   "API Requests"],
                  ["departments",   "Departments"],
                  ["chatbots",      "Chatbots"],
                  ["leads",         "Leads"],
                  ["tickets",       "Tickets"],
                ] as [keyof PlanLimits, string][]).map(([field, label]) => (
                  <div key={field}>
                    <label className="text-xs text-gray-500">{label}</label>
                    <Input
                      type="number"
                      min={-1}
                      {...planForm.register(`limits.${field}`, { valueAsNumber: true })}
                      className="mt-1 font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...planForm.register("isActive")} className="w-4 h-4 accent-indigo-600" />
                <span className="text-sm font-medium">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...planForm.register("isPopular")} className="w-4 h-4 accent-yellow-500" />
                <span className="text-sm font-medium">Mark as Popular</span>
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditPlan(null)}>Cancel</Button>
              <Button type="submit" disabled={updatePlanMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                {updatePlanMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Suspend */}
      <Dialog open={!!suspendModal} onOpenChange={() => setSuspendModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Suspend Company</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Suspend <strong>{suspendModal?.name}</strong>? All users will lose access immediately.
          </p>
          <div>
            <label className="text-sm font-medium">Reason</label>
            <Input value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} className="mt-1" placeholder="Reason for suspension…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendModal(null)}>Cancel</Button>
            <Button variant="destructive" disabled={suspendMutation.isPending}
              onClick={() => suspendModal && suspendMutation.mutate({ id: suspendModal.id, reason: suspendReason })}>
              {suspendMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Credits */}
      <Dialog open={!!creditsModal} onOpenChange={() => setCreditsModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add WhatsApp Credits</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Credit <strong>{creditsModal?.name}</strong>&apos;s WhatsApp wallet.
          </p>
          <div>
            <label className="text-sm font-medium">Amount (₹)</label>
            <Input type="number" min="1" value={creditsAmount} onChange={(e) => setCreditsAmount(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditsModal(null)}>Cancel</Button>
            <Button disabled={addCreditsMutation.isPending || !Number(creditsAmount)}
              onClick={() => creditsModal && addCreditsMutation.mutate({ companyId: creditsModal.id, amount: Number(creditsAmount) })}>
              {addCreditsMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Add ₹{Number(creditsAmount).toLocaleString("en-IN") || 0}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
