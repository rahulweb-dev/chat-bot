"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getInitials, formatDate, timeAgo } from "@/lib/utils";
import { Tag, Ticket, UserPlus, Star, Globe, Clock, MessageSquare, Phone, Mail, Bot, User, Wifi } from "lucide-react";

interface Conversation {
  _id: string;
  status: string;
  priority: string;
  channel: string;
  isBot: boolean;
  botHandedOver: boolean;
  visitor: { name?: string; email?: string; phone?: string; currentPage?: string; country?: string; city?: string; referrer?: string; userAgent?: string; visitorId: string; isLoggedIn: boolean };
  assignedTo?: { _id: string; name: string; email: string; avatar?: string };
  departmentId?: { _id: string; name: string; color: string };
  tags: string[];
  csat?: { rating: number; feedback?: string };
  createdAt: string;
  messageCount: number;
  firstResponseAt?: string;
  resolvedAt?: string;
  leadId?: string;
  ticketId?: string;
}

export function ConversationDetails({ conversationId }: { conversationId: string }) {
  const qc = useQueryClient();

  const { data: conv } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/conversations/${conversationId}`);
      const d = await res.json();
      return d.data as Conversation;
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents", "all"],
    queryFn: async () => {
      const res = await fetch("/api/agents?limit=50");
      const d = await res.json();
      return d.data;
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (agentId: string) => {
      await fetch(`/api/chat/conversations/${conversationId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversation", conversationId] }),
  });

  const updatePriority = async (priority: string) => {
    await fetch(`/api/chat/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
  };

  const createTicket = async () => {
    await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: `Chat from ${conv?.visitor?.name || conv?.visitor?.email || "Anonymous"}`,
        description: `Ticket created from conversation ${conversationId}`,
        requester: {
          name: conv?.visitor?.name || "Anonymous",
          email: conv?.visitor?.email || "",
        },
        conversationId,
      }),
    });
    qc.invalidateQueries({ queryKey: ["tickets"] });
  };

  const createLead = async () => {
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: conv?.visitor?.name || "Anonymous",
        email: conv?.visitor?.email,
        phone: conv?.visitor?.phone,
        source: "CHAT",
        conversationId,
      }),
    });
    qc.invalidateQueries({ queryKey: ["leads"] });
  };

  if (!conv) return null;

  const priorityColors: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-700",
    NORMAL: "bg-blue-100 text-blue-700",
    HIGH: "bg-orange-100 text-orange-700",
    URGENT: "bg-red-100 text-red-700",
  };

  // Derive customer type label
  const customerType = conv.visitor?.isLoggedIn
    ? "Logged In"
    : conv.visitor?.name
    ? "Identified"
    : "Anonymous";

  const customerTypeColor = conv.visitor?.isLoggedIn
    ? "bg-green-100 text-green-700"
    : conv.visitor?.name
    ? "bg-blue-100 text-blue-700"
    : "bg-gray-100 text-gray-500";

  const handledBy = conv.botHandedOver
    ? "Bot → Agent"
    : conv.isBot
    ? "Bot"
    : "Agent";

  const tagColors: Record<string, string> = {
    TEST_DRIVE:      "bg-purple-100 text-purple-700",
    BROCHURE_REQUEST:"bg-blue-100 text-blue-700",
    CALLBACK:        "bg-orange-100 text-orange-700",
    SERVICE:         "bg-yellow-100 text-yellow-700",
    SPARE_PARTS:     "bg-red-100 text-red-700",
    AUTO_DEALERSHIP: "bg-indigo-100 text-indigo-700",
    AGENT_REQUEST:   "bg-amber-100 text-amber-700",
    GENERAL:         "bg-gray-100 text-gray-600",
    WIDGET:          "bg-teal-100 text-teal-700",
  };

  return (
    <div className="w-72 border-l bg-white overflow-y-auto shrink-0">
      {/* Visitor info */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-12 h-12">
            <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold">
              {getInitials(conv.visitor?.name || conv.visitor?.email || "V")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{conv.visitor?.name || "Anonymous Visitor"}</p>
            {conv.visitor?.email && (
              <a href={`mailto:${conv.visitor.email}`} className="text-xs text-indigo-500 flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3 shrink-0" /><span className="truncate">{conv.visitor.email}</span>
              </a>
            )}
            {conv.visitor?.phone && (
              <a href={`tel:${conv.visitor.phone}`} className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 shrink-0" />{conv.visitor.phone}
              </a>
            )}
          </div>
        </div>

        {/* Customer type + handled by */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${customerTypeColor}`}>
            <User className="w-3 h-3" />{customerType}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 flex items-center gap-1">
            <Bot className="w-3 h-3" />{handledBy}
          </span>
          {conv.channel && conv.channel !== "WEB" && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-cyan-100 text-cyan-700 flex items-center gap-1">
              <Wifi className="w-3 h-3" />{conv.channel}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(conv.createdAt)}
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {conv.messageCount} msgs
          </div>
          {(conv.visitor?.city || conv.visitor?.country) && (
            <div className="flex items-center gap-1 col-span-2">
              <Globe className="w-3 h-3" />
              {[conv.visitor.city, conv.visitor.country].filter(Boolean).join(", ")}
            </div>
          )}
          {conv.csat && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500" />
              {conv.csat.rating}/5 CSAT
            </div>
          )}
          {conv.firstResponseAt && (
            <div className="flex items-center gap-1 col-span-2 text-green-600">
              <Clock className="w-3 h-3" />
              First reply {timeAgo(conv.firstResponseAt)}
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {conv.tags && conv.tags.length > 0 && (
        <div className="p-4 border-b">
          <p className="text-xs font-medium text-gray-500 mb-2">Tags / Intent</p>
          <div className="flex flex-wrap gap-1.5">
            {conv.tags.map((tag) => (
              <span
                key={tag}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColors[tag] || "bg-gray-100 text-gray-600"}`}
              >
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-b space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Assign Agent</label>
          <Select
            value={conv.assignedTo?._id}
            onValueChange={(v) => assignMutation.mutate(v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {agents?.map((agent: { _id: string; name: string; isOnline: boolean }) => (
                <SelectItem key={agent._id} value={agent._id}>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${agent.isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                    {agent.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Priority</label>
          <Select value={conv.priority} onValueChange={updatePriority}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-4 border-b space-y-2">
        <p className="text-xs font-medium text-gray-500 mb-2">Quick Actions</p>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8 text-xs" onClick={createTicket}>
          <Ticket className="w-3.5 h-3.5" /> Create Ticket
        </Button>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-8 text-xs" onClick={createLead}>
          <Tag className="w-3.5 h-3.5" /> Create Lead
        </Button>
      </div>

      {conv.visitor?.currentPage && (
        <div className="p-4 border-b">
          <p className="text-xs font-medium text-gray-500 mb-1">Current Page</p>
          <p className="text-xs text-gray-700 break-all">{conv.visitor.currentPage}</p>
        </div>
      )}

      {conv.visitor?.referrer && (
        <div className="p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Referrer</p>
          <p className="text-xs text-gray-700 break-all">{conv.visitor.referrer}</p>
        </div>
      )}
    </div>
  );
}
