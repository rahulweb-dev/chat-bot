"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Users, Trash2, Mail, MessageSquare, Clock, ShieldCheck, Send } from "lucide-react";
import { getInitials, timeAgo } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const agentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(["AGENT", "TEAM_LEADER", "MANAGER", "VIEWER"]),
  maxConcurrentChats: z.number().min(1).max(20).optional(),
  languages: z.string().optional(),
});

type AgentForm = z.infer<typeof agentSchema>;

const roleColors: Record<string, string> = {
  COMPANY_ADMIN: "bg-purple-100 text-purple-700 border-purple-200",
  MANAGER:       "bg-blue-100 text-blue-700 border-blue-200",
  TEAM_LEADER:   "bg-indigo-100 text-indigo-700 border-indigo-200",
  AGENT:         "bg-emerald-100 text-emerald-700 border-emerald-200",
  VIEWER:        "bg-gray-100 text-gray-600 border-gray-200",
};

interface Agent {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isOnline: boolean;
  lastLogin?: string;
  maxConcurrentChats: number;
  skills?: string[];
  avatar?: string;
}

export default function AgentsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "AGENT" });
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteDone, setInviteDone] = useState(false);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading } = useQuery({
    queryKey: ["agents", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/agents?limit=100${debouncedSearch ? `&search=${debouncedSearch}` : ""}`);
      const d = await res.json();
      return d.data as Agent[];
    },
  });

  const { data: usageData } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      const d = await res.json();
      return d.data;
    },
  });

  const agentUsage = usageData?.metrics?.find((m: { resource: string }) => m.resource === "agents");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AgentForm>({
    resolver: zodResolver(agentSchema),
    defaultValues: { role: "AGENT", maxConcurrentChats: 5 },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AgentForm) => {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          languages: (data.languages || "en").split(",").map((l) => l.trim()),
        }),
      });
      return res.json();
    },
    onSuccess: (res) => {
      if (res.success) {
        toast({ title: "Agent created successfully" });
        reset();
        setShowCreate(false);
        qc.invalidateQueries({ queryKey: ["agents"] });
        qc.invalidateQueries({ queryKey: ["usage"] });
      } else {
        toast({ title: res.error, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d?.success === false) throw new Error(d?.error || "Failed to remove agent");
    },
    onSuccess: () => {
      toast({ title: "Agent removed" });
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (err: unknown) => {
      toast({ title: err instanceof Error ? err.message : "Failed to remove agent", variant: "destructive" });
    },
  });

  const toggleActive = async (id: string, isActive: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d?.success === false) throw new Error(d?.error || "Failed to update agent status");
      await qc.invalidateQueries({ queryKey: ["agents"] });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to update agent status", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteSending(true);
    const res = await fetch("/api/agents/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteForm),
    });
    const d = await res.json();
    setInviteSending(false);
    if (d.success) {
      setInviteDone(true);
      toast({ title: `Invite sent to ${inviteForm.email}` });
      setTimeout(() => { setShowInvite(false); setInviteDone(false); setInviteForm({ name: "", email: "", role: "AGENT" }); }, 1500);
    } else {
      toast({ title: d.error || "Failed to send invite", variant: "destructive" });
    }
  }

  const agents = data || [];
  const onlineCount = agents.filter((a) => a.isOnline).length;
  const activeCount = agents.filter((a) => a.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span>{agents.length} total</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              {onlineCount} online
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
              {activeCount} active
            </span>
            {agentUsage && !agentUsage.isUnlimited && (
              <span className="text-gray-400">· {agentUsage.used}/{agentUsage.limit} slots</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowInvite(true)} variant="outline" className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <Send className="w-4 h-4" /> Invite by Email
          </Button>
          <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Plus className="w-4 h-4" /> Add Agent
          </Button>
        </div>
      </div>

      {/* Usage warning */}
      {agentUsage && !agentUsage.isUnlimited && agentUsage.percentage >= 80 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700 flex items-center justify-between">
          <span>⚠️ {agentUsage.used}/{agentUsage.limit} agent slots used</span>
          <Button size="sm" variant="outline" className="text-orange-700 border-orange-300 h-7 text-xs" asChild>
            <a href="/dashboard/billing">Upgrade Plan</a>
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agents..."
          className="pl-9"
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-52 bg-white rounded-2xl animate-pulse border" />
        ))}

        {!isLoading && agents.length === 0 && (
          <div className="col-span-3 text-center py-20 text-gray-400">
            <Users className="w-14 h-14 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-gray-500">No agents yet</p>
            <p className="text-sm mt-1">Add your first team member to get started</p>
            <Button className="mt-5 bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add First Agent
            </Button>
          </div>
        )}

        {agents.map((agent) => {
          const isToggling = togglingId === agent._id;
          return (
            <Card
              key={agent._id}
              className="border-0 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
            >
              {/* Thin top bar indicating status */}
              <div className={`h-1 w-full ${agent.isActive ? "bg-green-400" : "bg-red-300"}`} />

              <CardContent className="p-5">
                {/* Avatar + name row */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="relative shrink-0">
                    <Avatar className="w-12 h-12 ring-2 ring-white shadow-sm">
                      <AvatarImage src={agent.avatar} alt={agent.name} />
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-sm">
                        {getInitials(agent.name)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online dot */}
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${
                        agent.isOnline ? "bg-green-500" : "bg-gray-300"
                      }`}
                      title={agent.isOnline ? "Online" : "Offline"}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 leading-tight truncate">{agent.name}</p>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">{agent.email}</span>
                    </div>
                    <div className="mt-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 ${roleColors[agent.role] || roleColors.AGENT}`}
                      >
                        <ShieldCheck className="w-2.5 h-2.5 mr-1" />
                        {agent.role.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mb-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3 text-indigo-400" />
                    <span>{agent.maxConcurrentChats} concurrent chats</span>
                  </span>
                  {agent.lastLogin && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-gray-300" />
                      <span>{timeAgo(agent.lastLogin)}</span>
                    </span>
                  )}
                </div>

                {/* Skills */}
                {agent.skills && agent.skills.length > 0 && (
                  <div className="flex gap-1 mb-4 flex-wrap">
                    {agent.skills.slice(0, 4).map((skill) => (
                      <span
                        key={skill}
                        className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer: Status toggle + Delete */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  {/* ── STATUS TOGGLE BUTTON ── */}
                  <button
                    onClick={() => toggleActive(agent._id, agent.isActive)}
                    disabled={isToggling}
                    aria-pressed={agent.isActive}
                    aria-label={agent.isActive ? "Deactivate agent" : "Activate agent"}
                    className={`
                      inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border
                      transition-colors duration-200 select-none shadow-sm
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-400
                      ${isToggling ? "opacity-70 cursor-wait" : "cursor-pointer"}
                      ${agent.isActive
                        ? "bg-emerald-50 border-emerald-200 hover:border-emerald-300"
                        : "bg-rose-50/70 border-rose-200/80 hover:border-rose-300"
                      }
                    `}
                  >
                    {/* Status dot */}
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200
                        ${agent.isActive ? "bg-emerald-500" : "bg-rose-400"}
                      `}
                    />

                    {/* Label */}
                    <span
                      className={`text-[11px] font-medium tracking-wide transition-colors duration-200
                        ${agent.isActive ? "text-emerald-700" : "text-rose-500"}
                      `}
                    >
                      {isToggling ? "Updating…" : agent.isActive ? "Active" : "Inactive"}
                    </span>

                    {/* Mini switch */}
                    <span
                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full ml-0.5
                        transition-colors duration-200
                        ${agent.isActive ? "bg-emerald-500" : "bg-gray-300"}
                      `}
                    >
                      <span
                        className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ease-out
                          ${agent.isActive ? "translate-x-3.5" : "translate-x-0.5"}
                        `}
                      />
                    </span>
                  </button>

                  {/* Delete */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        aria-label={`Remove ${agent.name}`}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300
                          hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete agent"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {agent.name}?</AlertDialogTitle>
                        <AlertDialogDescription>They&apos;ll lose access immediately. This can&apos;t be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(agent._id)}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Invite Agent Dialog */}
      <Dialog open={showInvite} onOpenChange={v => { setShowInvite(v); if (!v) { setInviteDone(false); setInviteForm({ name: "", email: "", role: "AGENT" }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Agent by Email</DialogTitle>
          </DialogHeader>
          {inviteDone ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Send className="w-6 h-6 text-green-600" />
              </div>
              <p className="font-semibold text-gray-900">Invite sent!</p>
              <p className="text-sm text-gray-500 mt-1">They&apos;ll receive a link to create their account.</p>
            </div>
          ) : (
            <form onSubmit={sendInvite} className="space-y-3">
              <p className="text-sm text-gray-500">An email with a sign-up link will be sent. The link expires in 48 hours.</p>
              <div>
                <label className="text-sm font-medium">Full Name *</label>
                <input className="mt-1 w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300" value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} required placeholder="Jane Smith" />
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <input type="email" className="mt-1 w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} required placeholder="jane@company.com" />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <select className="mt-1 w-full border rounded-md px-3 py-2 text-sm" value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}>
                  <option value="AGENT">Agent</option>
                  <option value="TEAM_LEADER">Team Leader</option>
                  <option value="MANAGER">Manager</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
                <Button type="submit" disabled={inviteSending} className="bg-indigo-600 hover:bg-indigo-700">
                  {inviteSending ? "Sending…" : "Send Invite"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Agent Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Agent</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Full Name *</label>
              <Input {...register("name")} className="mt-1" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Email *</label>
              <Input {...register("email")} type="email" className="mt-1" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Password *</label>
              <Input {...register("password")} type="password" className="mt-1" placeholder="Min 8 characters" />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Role</label>
                <select {...register("role")} className="mt-1 w-full border rounded-md px-3 py-2 text-sm">
                  <option value="AGENT">Agent</option>
                  <option value="TEAM_LEADER">Team Leader</option>
                  <option value="MANAGER">Manager</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Max Chats</label>
                <Input
                  {...register("maxConcurrentChats", { valueAsNumber: true })}
                  type="number" min={1} max={20} className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Languages (comma-separated)</label>
              <Input {...register("languages")} className="mt-1" placeholder="en, es, fr" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {createMutation.isPending ? "Creating…" : "Create Agent"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
