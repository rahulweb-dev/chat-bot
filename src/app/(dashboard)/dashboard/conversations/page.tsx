"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Search, MessageSquare, CheckCircle, XCircle, Clock, Send, Bot, User, Phone, Mail, ArrowLeft, UserCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

const STATUS_CONFIG = {
  OPEN:     { label: "Open",     color: "bg-green-100 text-green-700",  icon: MessageSquare },
  PENDING:  { label: "Pending",  color: "bg-yellow-100 text-yellow-700", icon: Clock },
  RESOLVED: { label: "Resolved", color: "bg-blue-100 text-blue-700",    icon: CheckCircle },
  CLOSED:   { label: "Closed",   color: "bg-gray-100 text-gray-700",    icon: XCircle },
};

interface Conversation {
  _id: string;
  visitor?: { name?: string; email?: string; phone?: string };
  status: keyof typeof STATUS_CONFIG;
  channel: string;
  lastMessage?: string;
  assignedTo?: { name: string; email: string };
  unreadCount?: number;
  messageCount?: number;
  updatedAt: string;
  createdAt: string;
  metadata?: { needsAgent?: boolean };
}

interface Message {
  _id: string;
  content: string;
  senderType: "VISITOR" | "AGENT" | "BOT";
  senderName?: string;
  createdAt: string;
}

export default function ConversationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [reply, setReply] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["conversations-all", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const r = await fetch(`/api/chat/conversations?${params}`);
      const d = await r.json();
      return d.data as Conversation[];
    },
    refetchInterval: 8000,
  });

  const { data: messages, isLoading: msgsLoading } = useQuery({
    queryKey: ["conv-messages", selected?._id],
    queryFn: async () => {
      const r = await fetch(`/api/chat/conversations/${selected!._id}/messages?limit=100`);
      const d = await r.json();
      // API returns { data: { messages: [...], total, page } }
      return (d.data?.messages ?? d.data ?? []) as Message[];
    },
    enabled: !!selected,
    refetchInterval: 8000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`/api/chat/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      return r.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversations-all"] });
      if (selected?._id === vars.id) setSelected((s) => s ? { ...s, status: vars.status as keyof typeof STATUS_CONFIG } : s);
      toast({ title: "Conversation updated" });
    },
  });

  const sendReply = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const r = await fetch(`/api/chat/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, senderType: "AGENT" }),
      });
      return r.json();
    },
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["conv-messages", selected?._id] });
    },
    onError: () => toast({ title: "Failed to send reply", variant: "destructive" }),
  });

  const acceptConversation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/chat/conversations/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return r.json();
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["conversations-all"] });
      if (selected?._id === id) {
        setSelected(s => s ? { ...s, metadata: { needsAgent: false }, assignedTo: { name: "You", email: "" } } : s);
      }
      toast({ title: "You're now handling this conversation" });
    },
    onError: () => toast({ title: "Failed to accept conversation", variant: "destructive" }),
  });

  const conversations = (data || []).filter((c) => {
    if (!search) return true;
    return (c.visitor?.name || c.visitor?.email || "").toLowerCase().includes(search.toLowerCase());
  });

  const senderStyle = (type: string) => {
    if (type === "VISITOR") return { row: "justify-end", bub: "bg-indigo-600 text-white rounded-br-sm", time: "text-right" };
    if (type === "BOT") return { row: "justify-start", bub: "bg-gray-100 text-gray-800 rounded-bl-sm border", time: "text-left" };
    return { row: "justify-start", bub: "bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-bl-sm", time: "text-left" };
  };

  return (
    <div className="flex h-[calc(100vh-80px)] gap-0 -m-6 overflow-hidden">

      {/* ── Left: Conversation List ─────────────────────────────────────────── */}
      <div className={cn(
        "flex flex-col border-r bg-white",
        selected ? "hidden md:flex md:w-80 lg:w-96 shrink-0" : "flex-1"
      )}>
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <h1 className="text-lg font-bold">Conversations</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9 h-8 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          )}
          {!isLoading && conversations.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations found</p>
            </div>
          )}
          {conversations.map((conv) => {
            const cfg = STATUS_CONFIG[conv.status] || STATUS_CONFIG.OPEN;
            const isSelected = selected?._id === conv._id;
            return (
              <button
                key={conv._id}
                onClick={() => setSelected(conv)}
                className={cn(
                  "w-full text-left p-3 border-b hover:bg-gray-50 transition-colors",
                  isSelected && "bg-indigo-50 border-l-2 border-l-indigo-500"
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-sm bg-indigo-100 text-indigo-700">
                      {conv.visitor?.name?.charAt(0)?.toUpperCase() || "V"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-medium truncate">
                        {conv.visitor?.name || conv.visitor?.email || "Anonymous"}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage || "No messages yet"}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", cfg.color)}>{cfg.label}</span>
                      <Badge variant="outline" className="text-[10px] py-0">{conv.channel}</Badge>
                      {conv.metadata?.needsAgent && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">🔴 Needs Agent</span>
                      )}
                      {(conv.unreadCount || 0) > 0 && (
                        <span className="ml-auto text-[10px] bg-indigo-600 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Message Thread ───────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
          {/* Thread header */}
          <div className="px-4 py-3 bg-white border-b flex items-center gap-3">
            <button onClick={() => setSelected(null)} className="md:hidden text-gray-500 hover:text-gray-800">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm">
                {selected.visitor?.name?.charAt(0)?.toUpperCase() || "V"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{selected.visitor?.name || "Anonymous Visitor"}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {selected.visitor?.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{selected.visitor.email}</span>}
                {selected.visitor?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{selected.visitor.phone}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn("text-xs px-2 py-1 rounded-full font-medium", STATUS_CONFIG[selected.status]?.color)}>
                {STATUS_CONFIG[selected.status]?.label}
              </span>
              {selected.status === "OPEN" && (
                <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => updateStatus.mutate({ id: selected._id, status: "RESOLVED" })}>
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Resolve
                </Button>
              )}
              {selected.status === "RESOLVED" && (
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => updateStatus.mutate({ id: selected._id, status: "CLOSED" })}>
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Close
                </Button>
              )}
            </div>
          </div>

          {/* Needs Agent Banner */}
          {selected.metadata?.needsAgent && (
            <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
                <span className="font-medium">Visitor requested a live agent</span>
              </div>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs shrink-0"
                onClick={() => acceptConversation.mutate(selected._id)}
                disabled={acceptConversation.isPending}
              >
                {acceptConversation.isPending
                  ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  : <UserCheck className="w-3 h-3 mr-1" />}
                Accept Conversation
              </Button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgsLoading && (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            )}
            {!msgsLoading && (!messages || messages.length === 0) && (
              <div className="text-center py-12 text-gray-400">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No messages yet</p>
              </div>
            )}
            {messages?.map((msg) => {
              const style = senderStyle(msg.senderType);
              return (
                <div key={msg._id} className={cn("flex gap-2", style.row)}>
                  {msg.senderType !== "VISITOR" && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
                      bg-gray-200 text-gray-600">
                      {msg.senderType === "BOT"
                        ? <Bot className="w-4 h-4" />
                        : <User className="w-4 h-4" />}
                    </div>
                  )}
                  <div className="max-w-[70%]">
                    {msg.senderType !== "VISITOR" && (
                      <p className="text-[10px] text-gray-400 mb-0.5 ml-1">
                        {msg.senderType === "BOT" ? "🤖 Bot" : `👤 ${msg.senderName || "Agent"}`}
                      </p>
                    )}
                    <div className={cn("px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed", style.bub)}>
                      {msg.content}
                    </div>
                    <p className={cn("text-[10px] text-gray-400 mt-1 px-1", style.time)}>
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply input */}
          {selected.status !== "CLOSED" && (
            <div className="p-3 bg-white border-t flex gap-2 items-end">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && reply.trim()) {
                    e.preventDefault();
                    sendReply.mutate({ id: selected._id, content: reply });
                  }
                }}
                placeholder="Type a reply… (Enter to send)"
                rows={2}
                className="flex-1 border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 max-h-28"
              />
              <Button
                size="icon"
                className="bg-indigo-600 hover:bg-indigo-700 shrink-0 h-9 w-9"
                disabled={!reply.trim() || sendReply.isPending}
                onClick={() => sendReply.mutate({ id: selected._id, content: reply })}
              >
                {sendReply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          )}
          {selected.status === "CLOSED" && (
            <div className="p-3 bg-gray-50 border-t text-center text-xs text-gray-400">
              This conversation is closed
            </div>
          )}
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 text-gray-400 flex-col gap-3">
          <MessageSquare className="w-14 h-14 opacity-15" />
          <p className="text-sm font-medium">Select a conversation to view messages</p>
        </div>
      )}
    </div>
  );
}
