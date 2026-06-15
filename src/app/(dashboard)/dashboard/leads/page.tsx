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
import { Plus, Search, IndianRupee, Mail, Phone, Bot, Zap } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "MEETING", "PROPOSAL", "WON", "LOST"] as const;

const stageColors: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-700 border-gray-200",
  CONTACTED: "bg-blue-50 text-blue-700 border-blue-200",
  QUALIFIED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  MEETING: "bg-purple-50 text-purple-700 border-purple-200",
  PROPOSAL: "bg-orange-50 text-orange-700 border-orange-200",
  WON: "bg-green-50 text-green-700 border-green-200",
  LOST: "bg-red-50 text-red-700 border-red-200",
};

const leadSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  source: z.string().optional(),
  stage: z.enum(STAGES).optional(),
  value: z.number().optional(),
});

type LeadForm = z.infer<typeof leadSchema>;

export default function LeadsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [activeStage, setActiveStage] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["leads", search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "200" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/leads?${params}`);
      const d = await res.json();
      return d.data as Lead[];
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
    defaultValues: { stage: "NEW", source: "MANUAL" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: LeadForm) => {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (res) => {
      if (res.success) {
        toast({ title: "Lead created successfully" });
        reset();
        setShowCreate(false);
        qc.invalidateQueries({ queryKey: ["leads"] });
      } else {
        toast({ title: res.error, variant: "destructive" });
      }
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  const leads = data || [];

  const leadsByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = leads.filter((l) => l.stage === stage);
    return acc;
  }, {} as Record<string, Lead[]>);

  const totalValue = leads.filter((l) => l.stage === "WON").reduce((sum, l) => sum + (l.value || 0), 0);
  const hotLeads = leads.filter((l) => (l.score || 0) >= 75).length;
  const chatbotLeads = leads.filter((l) => l.source === "CHAT_WIDGET").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads & CRM</h1>
          <p className="text-gray-500 text-sm mt-1">
            {leads.length} leads · <span className="text-green-600 font-medium">₹{totalValue.toLocaleString()} won</span>
            {chatbotLeads > 0 && <span className="ml-2 text-indigo-600">· 🤖 {chatbotLeads} from chatbot</span>}
            {hotLeads > 0 && <span className="ml-2 text-orange-600">· 🔥 {hotLeads} hot</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${viewMode === "kanban" ? "bg-white shadow" : "text-gray-500"}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${viewMode === "list" ? "bg-white shadow" : "text-gray-500"}`}
            >
              List
            </button>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Add Lead
          </Button>
        </div>
      </div>

      <div className="relative w-72">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className="pl-9" />
      </div>

      {viewMode === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageLeads = leadsByStage[stage] || [];
            const stageValue = stageLeads.reduce((sum, l) => sum + (l.value || 0), 0);
            return (
              <div key={stage} className="shrink-0 w-64">
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${stageColors[stage]}`}>
                  <span className="text-sm font-semibold">{stage}</span>
                  <Badge variant="secondary" className="text-xs">{stageLeads.length}</Badge>
                </div>
                {stageValue > 0 && (
                  <div className={`px-3 py-1 border-x text-xs text-gray-500 flex items-center gap-1 ${stageColors[stage].split(" ")[0]}`}>
                    <IndianRupee className="w-3 h-3" />{stageValue.toLocaleString()}
                  </div>
                )}
                <div className="min-h-[200px] bg-gray-50 rounded-b-lg border border-t-0 p-2 space-y-2">
                  {stageLeads.map((lead) => (
                    <div key={lead._id} className="bg-white rounded-lg p-3 border shadow-sm cursor-grab">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-medium text-sm leading-tight">{lead.name}</p>
                        <div className="flex gap-1 shrink-0">
                          {lead.source === "CHAT_WIDGET" && (
                            <span title="From Chatbot"><Bot className="w-3.5 h-3.5 text-indigo-400" /></span>
                          )}
                          {(lead.score || 0) >= 75 && (
                            <span title={`Score: ${lead.score}`}><Zap className="w-3.5 h-3.5 text-orange-400" /></span>
                          )}
                        </div>
                      </div>
                      {lead.company && <p className="text-xs text-gray-500 mt-0.5">{lead.company}</p>}
                      {lead.phone && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <Phone className="w-3 h-3" /><span>{lead.phone}</span>
                        </div>
                      )}
                      {lead.email && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                          <Mail className="w-3 h-3" /><span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        {lead.value ? (
                          <div className="flex items-center gap-0.5 text-xs text-green-600 font-medium">
                            <IndianRupee className="w-3 h-3" />{lead.value.toLocaleString()}
                          </div>
                        ) : lead.score ? (
                          <span className="text-xs text-gray-400">Score: {lead.score}</span>
                        ) : <span />}
                        <span className="text-[10px] text-gray-400">{timeAgo(lead.createdAt)}</span>
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {STAGES.filter((s) => s !== stage).slice(0, 2).map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStageMutation.mutate({ id: lead._id, stage: s })}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
                          >
                            → {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No leads</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <Card key={lead._id} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-700 shrink-0">
                  {lead.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{lead.name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                    {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                    {lead.company && <span>{lead.company}</span>}
                    <span>{timeAgo(lead.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {lead.source === "CHAT_WIDGET" && <span title="From chatbot"><Bot className="w-4 h-4 text-indigo-400" /></span>}
                  {(lead.score || 0) >= 75 && <span title={`Hot lead – score ${lead.score}`}><Zap className="w-4 h-4 text-orange-400" /></span>}
                  {lead.value ? (
                    <span className="text-sm font-medium text-green-600 flex items-center gap-0.5"><IndianRupee className="w-3.5 h-3.5" />{lead.value.toLocaleString()}</span>
                  ) : lead.score ? (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{lead.score}pts</span>
                  ) : null}
                  <span className={`text-xs px-2 py-1 rounded-full font-medium border ${stageColors[lead.stage]}`}>
                    {lead.stage}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input {...register("name")} className="mt-1" />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input {...register("email")} type="email" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Company</label>
                <Input {...register("company")} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input {...register("phone")} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Stage</label>
                <select {...register("stage")} className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Deal Value (₹)</label>
                <Input {...register("value", { valueAsNumber: true })} type="number" className="mt-1" placeholder="0" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                {createMutation.isPending ? "Saving..." : "Add Lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface Lead {
  _id: string;
  name: string;
  email?: string;
  company?: string;
  phone?: string;
  stage: string;
  value?: number;
  score?: number;
  source?: string;
  createdAt: string;
  assignedTo?: { name: string };
}
