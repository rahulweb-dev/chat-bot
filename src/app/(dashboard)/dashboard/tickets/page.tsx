"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Ticket, Clock, CheckCircle, XCircle, Send, MessageSquare, Phone, Mail, Car } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const ticketSchema = z.object({
  subject: z.string().min(3),
  description: z.string().min(10),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  requesterName: z.string().min(2),
  requesterEmail: z.string().email(),
  category: z.string().optional(),
});

type TicketForm = z.infer<typeof ticketSchema>;

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  OPEN: { label: "Open", color: "bg-blue-100 text-blue-700", icon: Ticket },
  ASSIGNED: { label: "Assigned", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  PENDING: { label: "Pending", color: "bg-orange-100 text-orange-700", icon: Clock },
  RESOLVED: { label: "Resolved", color: "bg-green-100 text-green-700", icon: CheckCircle },
  CLOSED: { label: "Closed", color: "bg-gray-100 text-gray-600", icon: XCircle },
};

const priorityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  NORMAL: "bg-blue-100 text-blue-600",
  HIGH: "bg-orange-100 text-orange-600",
  URGENT: "bg-red-100 text-red-600",
};

interface TicketDetail {
  _id: string; ticketNumber: string; subject: string; description: string;
  status: string; priority: string; category?: string; createdAt: string;
  requester: { name: string; email: string; phone?: string };
  assignedTo?: { name: string; email: string };
  customFields?: { vehicleNumber?: string; serviceType?: string };
  comments: { content: string; isInternal: boolean; requesterComment: boolean; createdAt: string; createdBy?: { name: string } }[];
}

export default function TicketsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [comment, setComment] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["tickets", statusFilter, priorityFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/tickets?${params}`);
      const d = await res.json();
      return d;
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { priority: "NORMAL" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TicketForm) => {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          requester: { name: data.requesterName, email: data.requesterEmail },
        }),
      });
      return res.json();
    },
    onSuccess: (res) => {
      if (res.success) {
        toast({ title: "Ticket created successfully", variant: "default" });
        reset();
        setShowCreate(false);
        qc.invalidateQueries({ queryKey: ["tickets"] });
      } else {
        toast({ title: res.error, variant: "destructive" });
      }
    },
  });

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    qc.invalidateQueries({ queryKey: ["tickets"] });
    if (selectedTicket?._id === id) setSelectedTicket((t) => t ? { ...t, status } : t);
    toast({ title: `Ticket marked as ${status}` });
  };

  const addComment = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const r = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addComment: { content, isInternal: false } }),
      });
      return r.json();
    },
    onSuccess: (res) => {
      if (res.success) {
        setComment("");
        setSelectedTicket(res.data);
        qc.invalidateQueries({ queryKey: ["tickets"] });
      } else {
        toast({ title: res.error || "Failed to add comment", variant: "destructive" });
      }
    },
  });

  async function openTicket(id: string) {
    const r = await fetch(`/api/tickets/${id}`);
    const d = await r.json();
    if (d.success) setSelectedTicket(d.data);
  }

  const tickets = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tickets</h1>
          <p className="text-gray-500 text-sm mt-1">
            {pagination?.total || 0} tickets total
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" /> New Ticket
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..." className="pl-9 w-64" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.keys(statusConfig).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {isLoading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-xl animate-pulse border" />
        ))}

        {!isLoading && tickets.length === 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center text-gray-400">
              <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No tickets found</p>
              <Button className="mt-4" onClick={() => setShowCreate(true)}>Create First Ticket</Button>
            </CardContent>
          </Card>
        )}

        {tickets.map((ticket: {
          _id: string; ticketNumber: string; subject: string; status: string;
          priority: string; createdAt: string; assignedTo?: { name: string };
          requester: { name: string; email: string };
        }) => {
          const statusCfg = statusConfig[ticket.status] || statusConfig.OPEN;
          const StatusIcon = statusCfg.icon;
          return (
            <Card key={ticket._id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openTicket(ticket._id)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${statusCfg.color.replace("text-", "bg-").split(" ")[0]}10`}>
                    <StatusIcon className={`w-4 h-4 ${statusCfg.color.split(" ")[1]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs text-gray-400 font-mono">{ticket.ticketNumber}</span>
                        <h3 className="font-medium text-gray-900 mt-0.5">{ticket.subject}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {ticket.requester?.name} · {ticket.requester?.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityColors[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>{timeAgo(ticket.createdAt)}</span>
                      {ticket.assignedTo && <span>→ {ticket.assignedTo.name}</span>}
                      <div className="ml-auto flex gap-2">
                        {ticket.status !== "RESOLVED" && (
                          <button
                            onClick={() => updateStatus(ticket._id, "RESOLVED")}
                            className="text-green-600 hover:underline"
                          >
                            Resolve
                          </button>
                        )}
                        {ticket.status !== "CLOSED" && ticket.status === "RESOLVED" && (
                          <button
                            onClick={() => updateStatus(ticket._id, "CLOSED")}
                            className="text-gray-600 hover:underline"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Requester Name</label>
                <Input {...register("requesterName")} className="mt-1" placeholder="John Doe" />
                {errors.requesterName && <p className="text-xs text-red-500 mt-1">{errors.requesterName.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Requester Email</label>
                <Input {...register("requesterEmail")} type="email" className="mt-1" placeholder="john@example.com" />
                {errors.requesterEmail && <p className="text-xs text-red-500 mt-1">{errors.requesterEmail.message}</p>}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input {...register("subject")} className="mt-1" placeholder="Describe the issue briefly" />
              {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                {...register("description")}
                rows={4}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                placeholder="Detailed description..."
              />
              {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Priority</label>
                <select {...register("priority")} className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:outline-none">
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <Input {...register("category")} className="mt-1" placeholder="e.g. Technical, Billing" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                {createMutation.isPending ? "Creating..." : "Create Ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Ticket Detail Dialog ──────────────────────────────────────────────── */}
      {selectedTicket && (
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{selectedTicket.ticketNumber}</span>
                {selectedTicket.subject}
              </DialogTitle>
            </DialogHeader>

            {/* Status bar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusConfig[selectedTicket.status]?.color}`}>
                {statusConfig[selectedTicket.status]?.label}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${priorityColors[selectedTicket.priority]}`}>
                {selectedTicket.priority}
              </span>
              {selectedTicket.category && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">{selectedTicket.category}</span>
              )}
              <div className="ml-auto flex gap-2">
                {selectedTicket.status !== "RESOLVED" && (
                  <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50"
                    onClick={() => updateStatus(selectedTicket._id, "RESOLVED")}>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Resolve
                  </Button>
                )}
                {selectedTicket.status === "RESOLVED" && (
                  <Button size="sm" variant="outline" className="text-gray-600"
                    onClick={() => updateStatus(selectedTicket._id, "CLOSED")}>
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Close
                  </Button>
                )}
              </div>
            </div>

            {/* Requester + vehicle info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Requester</p>
                <p className="font-medium text-sm">{selectedTicket.requester.name}</p>
                {selectedTicket.requester.email && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Mail className="w-3.5 h-3.5" />{selectedTicket.requester.email}
                  </div>
                )}
                {selectedTicket.requester.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Phone className="w-3.5 h-3.5" />{selectedTicket.requester.phone}
                  </div>
                )}
              </div>
              {(selectedTicket.customFields?.vehicleNumber || selectedTicket.customFields?.serviceType) && (
                <div className="bg-indigo-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Vehicle Info</p>
                  {selectedTicket.customFields.vehicleNumber && (
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <Car className="w-3.5 h-3.5 text-indigo-500" />{selectedTicket.customFields.vehicleNumber}
                    </div>
                  )}
                  {selectedTicket.customFields.serviceType && (
                    <p className="text-xs text-indigo-700">{selectedTicket.customFields.serviceType}</p>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedTicket.description}</p>
            </div>

            {/* Comments */}
            {selectedTicket.comments?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Comments ({selectedTicket.comments.length})
                </p>
                {selectedTicket.comments.map((c, i) => (
                  <div key={i} className={`rounded-xl p-3 text-sm ${c.requesterComment ? "bg-blue-50 border border-blue-100" : "bg-white border"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-xs">{c.requesterComment ? selectedTicket.requester.name : (c.createdBy?.name || "Agent")}</span>
                      <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                      {c.isInternal && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Internal</span>}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment */}
            {!["CLOSED", "RESOLVED"].includes(selectedTicket.status) && (
              <div className="flex gap-2">
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment or reply…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && comment.trim()) {
                      e.preventDefault();
                      addComment.mutate({ id: selectedTicket._id, content: comment });
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
                  disabled={!comment.trim() || addComment.isPending}
                  onClick={() => addComment.mutate({ id: selectedTicket._id, content: comment })}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
