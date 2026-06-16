"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2, Users, DollarSign, TrendingUp, AlertTriangle,
  Plus, Search, Ban, CheckCircle, Trash2, Crown, Globe, Wallet, Loader2,
} from "lucide-react";
import axios from "axios";
import { timeAgo, formatNumber } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const createCompanySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  planType: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
});

type CreateCompanyForm = z.infer<typeof createCompanySchema>;

export function SuperAdminDashboard() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [suspendModal, setSuspendModal] = useState<{ id: string; name: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [creditsModal, setCreditsModal] = useState<{ id: string; name: string } | null>(null);
  const [creditsAmount, setCreditsAmount] = useState("1000");

  const { data: companies, isLoading } = useQuery({
    queryKey: ["admin-companies", search],
    queryFn: async () => {
      const res = await fetch(`/api/companies?limit=50${search ? `&search=${search}` : ""}`);
      const d = await res.json();
      return d;
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateCompanyForm>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: { planType: "STARTER" },
  });

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
        toast({ title: "Company created successfully" });
        reset();
        setShowCreate(false);
        qc.invalidateQueries({ queryKey: ["admin-companies"] });
      } else {
        toast({ title: res.error, variant: "destructive" });
      }
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/companies/${id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Company suspended" });
      setSuspendModal(null);
      setSuspendReason("");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    },
  });

  const unsuspendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${id}/suspend`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Company unsuspended" });
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/companies/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "Company deleted" });
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    },
  });

  const addCreditsMutation = useMutation({
    mutationFn: ({ companyId, amount }: { companyId: string; amount: number }) =>
      axios.post("/api/whatsapp/wallet/add-credits", { companyId, amount }),
    onSuccess: () => {
      toast({ title: "WhatsApp credits added" });
      setCreditsModal(null);
      setCreditsAmount("1000");
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to add credits";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const data = companies?.data || [];
  const total = companies?.pagination?.total || 0;
  const activeCount = data.filter((c: { isActive: boolean; isSuspended: boolean }) => c.isActive && !c.isSuspended).length;
  const suspendedCount = data.filter((c: { isSuspended: boolean }) => c.isSuspended).length;

  const planColors: Record<string, string> = {
    STARTER: "bg-blue-100 text-blue-700",
    PRO: "bg-indigo-100 text-indigo-700",
    ENTERPRISE: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Super Admin</h1>
        <p className="text-gray-500 text-sm mt-1">Platform overview and management</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Building2, label: "Total Companies", value: total, color: "text-blue-600", bg: "bg-blue-50" },
          { icon: CheckCircle, label: "Active Companies", value: activeCount, color: "text-green-600", bg: "bg-green-50" },
          { icon: Ban, label: "Suspended", value: suspendedCount, color: "text-red-600", bg: "bg-red-50" },
          { icon: DollarSign, label: "Est. MRR", value: `$${(total * 50).toLocaleString()}`, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className="text-2xl font-bold">{typeof card.value === "number" ? formatNumber(card.value) : card.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search companies..." className="pl-9 w-72" />
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" /> Create Company
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-xl animate-pulse border" />
        ))}

        {data.map((company: {
          _id: string; name: string; email: string; slug: string;
          isActive: boolean; isSuspended: boolean; suspendReason?: string;
          planId?: { type: string; name: string }; createdAt: string;
          trialEndsAt?: string;
        }) => (
          <Card key={company._id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{company.name}</p>
                    {company.isSuspended && (
                      <Badge variant="destructive" className="text-xs">Suspended</Badge>
                    )}
                    {!company.isActive && !company.isSuspended && (
                      <Badge variant="outline" className="text-xs text-gray-500">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    <span>{company.email}</span>
                    <span>{timeAgo(company.createdAt)}</span>
                    {company.trialEndsAt && new Date(company.trialEndsAt) > new Date() && (
                      <span className="text-yellow-600">Trial ends {new Date(company.trialEndsAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  {company.isSuspended && company.suspendReason && (
                    <p className="text-xs text-red-500 mt-1">Reason: {company.suspendReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {company.planId && (
                    <Badge variant="outline" className={`text-xs ${planColors[company.planId.type] || ""}`}>
                      {company.planId.name}
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => setCreditsModal({ id: company._id, name: company.name })}
                  >
                    <Wallet className="w-3 h-3 mr-1" /> Add Credits
                  </Button>
                  {!company.isSuspended ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                      onClick={() => setSuspendModal({ id: company._id, name: company.name })}
                    >
                      <Ban className="w-3 h-3 mr-1" /> Suspend
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => unsuspendMutation.mutate(company._id)}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" /> Restore
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => deleteMutation.mutate(company._id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-3 ">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Company Name *</label>
                <Input {...register("name")} className="mt-1" />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Company Email *</label>
                <Input {...register("email")} type="email" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Admin Name *</label>
                <Input {...register("adminName")} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Admin Email *</label>
                <Input {...register("adminEmail")} type="email" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Admin Password *</label>
                <Input {...register("adminPassword")} type="password" className="mt-1" />
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                {createMutation.isPending ? "Creating..." : "Create Company"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!suspendModal} onOpenChange={() => setSuspendModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Suspend Company</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Suspend <strong>{suspendModal?.name}</strong>? All company users will lose access.
          </p>
          <div>
            <label className="text-sm font-medium">Reason</label>
            <Input
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="mt-1"
              placeholder="Reason for suspension..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendModal(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => suspendModal && suspendMutation.mutate({ id: suspendModal.id, reason: suspendReason })}
              disabled={suspendMutation.isPending}
            >
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creditsModal} onOpenChange={() => setCreditsModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add WhatsApp Credits</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Credit <strong>{creditsModal?.name}</strong>&apos;s WhatsApp wallet. This is a platform-level action — company admins cannot self-serve top-ups.
          </p>
          <div>
            <label className="text-sm font-medium">Amount (INR)</label>
            <Input
              type="number"
              min="1"
              value={creditsAmount}
              onChange={(e) => setCreditsAmount(e.target.value)}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditsModal(null)}>Cancel</Button>
            <Button
              onClick={() => creditsModal && addCreditsMutation.mutate({ companyId: creditsModal.id, amount: Number(creditsAmount) })}
              disabled={addCreditsMutation.isPending || !Number(creditsAmount)}
            >
              {addCreditsMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Add ₹{creditsAmount || 0}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
