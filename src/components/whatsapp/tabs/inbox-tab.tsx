"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Search, MessageCircle, FileText, LayoutTemplate, Download, Loader2, X } from "lucide-react";
import { cn, getInitials, timeAgo } from "@/lib/utils";
import { EmptyState } from "@/components/whatsapp/empty-state";

interface Conversation {
  _id: string;
  customerName?: string;
  customerPhone: string;
  lastMessage?: string;
  lastMessageAt?: string;
  status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
  tags: string[];
  unreadCount: number;
  assignedAgentId?: { _id: string; name: string };
}

interface Message {
  _id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  messageType: "TEXT" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" | "TEMPLATE";
  content?: string;
  mediaUrl?: string;
  templateName?: string;
  status: string;
  createdAt: string;
}

interface WATemplate {
  name: string;
  language: string;
  category: string;
  bodyText?: string;
  bodyParamCount: number;
}

let socket: Socket | null = null;

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === "OUTBOUND";
  const mediaSrc = message.mediaUrl ? `/api/whatsapp/media/${message.mediaUrl}` : undefined;

  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[65%] px-3 py-2.5 rounded-2xl text-sm",
          isOutbound ? "bg-green-600 text-white rounded-tr-sm" : "bg-white border rounded-tl-sm shadow-sm"
        )}
      >
        {message.messageType === "IMAGE" && mediaSrc && (
          <img src={mediaSrc} alt="attachment" className="max-w-60 rounded-lg mb-1" />
        )}
        {message.messageType === "VIDEO" && mediaSrc && (
          <video src={mediaSrc} controls className="max-w-60 rounded-lg mb-1" />
        )}
        {message.messageType === "AUDIO" && mediaSrc && (
          <audio src={mediaSrc} controls className="mb-1" />
        )}
        {message.messageType === "DOCUMENT" && mediaSrc && (
          <a
            href={mediaSrc}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 text-xs underline mb-1",
              isOutbound ? "text-white" : "text-indigo-600"
            )}
          >
            <Download className="w-3.5 h-3.5" /> Download document
          </a>
        )}
        {message.messageType === "TEMPLATE" && (
          <div className={cn("flex items-center gap-1.5 text-xs font-medium mb-1", isOutbound ? "text-green-100" : "text-indigo-600")}>
            <LayoutTemplate className="w-3.5 h-3.5" /> Template: {message.templateName}
          </div>
        )}
        {message.content && message.content !== `[Template: ${message.templateName}]` && (
          <span className="px-1">{message.content}</span>
        )}
        <div className={cn("text-[10px] mt-1 px-1", isOutbound ? "text-green-100" : "text-gray-400")}>
          {timeAgo(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function TemplatePickerDialog({
  open,
  onOpenChange,
  onSend,
  sending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSend: (templateName: string, templateLanguage: string, bodyParams: string[]) => void;
  sending: boolean;
}) {
  const [selected, setSelected] = useState<WATemplate | null>(null);
  const [params, setParams] = useState<string[]>([]);

  const { data: templates, isLoading } = useQuery<WATemplate[]>({
    queryKey: ["whatsapp-templates"],
    queryFn: () => axios.get("/api/whatsapp/templates").then((r) => r.data.data),
    enabled: open,
  });

  const handleSelect = (name: string) => {
    const tpl = templates?.find((t) => t.name === name) || null;
    setSelected(tpl);
    setParams(tpl ? Array(tpl.bodyParamCount).fill("") : []);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Send Template Message</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : templates?.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No approved templates found. Templates must be created and approved in your Meta Business account before they appear here.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selected?.name || ""} onValueChange={handleSelect}>
                <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
                <SelectContent>
                  {templates?.map((t) => (
                    <SelectItem key={t.name} value={t.name}>{t.name} ({t.language})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected?.bodyText && (
              <div className="bg-gray-50 border rounded-lg p-3 text-sm text-gray-600">{selected.bodyText}</div>
            )}
            {params.map((val, i) => (
              <div key={i} className="space-y-2">
                <Label className="text-xs">Variable {`{{${i + 1}}}`}</Label>
                <Input
                  value={val}
                  onChange={(e) => setParams((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))}
                />
              </div>
            ))}
            <Button
              className="w-full"
              disabled={!selected || sending}
              onClick={() => selected && onSend(selected.name, selected.language, params)}
            >
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Template
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InboxTab() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["whatsapp-conversations", search, statusFilter],
    queryFn: () =>
      axios
        .get("/api/whatsapp/conversations", {
          params: { search: search || undefined, status: statusFilter !== "ALL" ? statusFilter : undefined, limit: 50 },
        })
        .then((r) => r.data.data),
    refetchInterval: 15000,
  });

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["whatsapp-messages", activeId],
    queryFn: () => axios.get(`/api/whatsapp/conversations/${activeId}/messages`).then((r) => r.data.data.messages),
    enabled: !!activeId,
  });

  const filteredMessages = useMemo(() => {
    if (!messageSearch.trim()) return messages || [];
    const q = messageSearch.toLowerCase();
    return (messages || []).filter((m) => m.content?.toLowerCase().includes(q));
  }, [messages, messageSearch]);

  const sendMessage = useMutation({
    mutationFn: (payload: { content?: string; templateName?: string; templateLanguage?: string; templateBodyParams?: string[] }) =>
      axios.post(`/api/whatsapp/conversations/${activeId}/messages`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-messages", activeId] });
      qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      setInput("");
      setTemplateDialogOpen(false);
    },
  });

  const assignAgent = useMutation({
    mutationFn: (agentId: string) => axios.patch(`/api/whatsapp/conversations/${activeId}`, { assignedAgentId: agentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] }),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => axios.patch(`/api/whatsapp/conversations/${activeId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] }),
  });

  const { data: agents } = useQuery({
    queryKey: ["agents", "all"],
    queryFn: () => axios.get("/api/agents?limit=50").then((r) => r.data.data),
  });

  useEffect(() => {
    if (!session?.user || socket) return;
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "", {
      auth: { token: session.user.id },
      transports: ["websocket", "polling"],
    });

    socket.on("whatsapp:message:new", () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    });
    socket.on("whatsapp:conversation:updated", () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    });
    socket.on("whatsapp:status:update", () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-messages"] });
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredMessages]);

  const active = conversations?.find((c) => c._id === activeId);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex-1 flex border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="w-80 border-r flex flex-col shrink-0">
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone" className="pl-8 h-8 text-sm" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : conversations?.length === 0 ? (
              <EmptyState icon={MessageCircle} title="No conversations yet" description="Inbound WhatsApp messages will show up here." />
            ) : (
              (conversations || []).map((c) => (
                <button
                  key={c._id}
                  onClick={() => setActiveId(c._id)}
                  className={cn(
                    "w-full text-left p-3 border-b hover:bg-gray-50 flex items-start gap-2.5",
                    activeId === c._id && "bg-indigo-50"
                  )}
                >
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarFallback className="bg-green-100 text-green-700 text-xs">{getInitials(c.customerName || c.customerPhone)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{c.customerName || c.customerPhone}</p>
                      {c.lastMessageAt && <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(c.lastMessageAt)}</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{c.lastMessage}</p>
                  </div>
                  {c.unreadCount > 0 && (
                    <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0 shrink-0">{c.unreadCount}</Badge>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {active ? (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{active.customerName || active.customerPhone}</p>
                <p className="text-xs text-gray-400">{active.customerPhone}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3 w-3 text-gray-400" />
                  <Input
                    value={messageSearch}
                    onChange={(e) => setMessageSearch(e.target.value)}
                    placeholder="Search messages"
                    className="pl-6 h-8 text-xs w-36"
                  />
                  {messageSearch && (
                    <button onClick={() => setMessageSearch("")} className="absolute right-2 top-2">
                      <X className="h-3 w-3 text-gray-400" />
                    </button>
                  )}
                </div>
                <Select value={active.assignedAgentId?._id || ""} onValueChange={(v) => assignAgent.mutate(v)}>
                  <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {(agents || []).map((a: { _id: string; name: string }) => (
                      <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={active.status} onValueChange={(v) => updateStatus.mutate(v)}>
                  <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messageSearch && filteredMessages.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No messages match &quot;{messageSearch}&quot;</p>
              ) : (
                filteredMessages.map((m) => <MessageBubble key={m._id} message={m} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t flex gap-2">
              <Button variant="outline" size="icon" className="shrink-0" title="Send template" onClick={() => setTemplateDialogOpen(true)}>
                <FileText className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && input.trim()) {
                    e.preventDefault();
                    sendMessage.mutate({ content: input.trim() });
                  }
                }}
                placeholder="Type a message... (outside 24h window, use a template instead)"
              />
              <Button onClick={() => input.trim() && sendMessage.mutate({ content: input.trim() })} disabled={sendMessage.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={MessageCircle} title="Select a conversation" description="Choose a conversation from the list to view and reply to messages." />
          </div>
        )}
      </div>

      <TemplatePickerDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        sending={sendMessage.isPending}
        onSend={(templateName, templateLanguage, templateBodyParams) =>
          sendMessage.mutate({ templateName, templateLanguage, templateBodyParams })
        }
      />
    </div>
  );
}
