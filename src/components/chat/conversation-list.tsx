"use client";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, RefreshCw, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, timeAgo, getInitials } from "@/lib/utils";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Conversation {
  _id: string;
  status: string;
  visitor: { name?: string; email?: string; visitorId: string };
  assignedTo?: { name: string; avatar?: string };
  lastMessageAt?: string;
  messageCount: number;
  tags: string[];
  priority: string;
  createdAt: string;
}

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
}

const statusColors: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-gray-100 text-gray-700",
  CLOSED: "bg-red-100 text-red-700",
};

const priorityDot: Record<string, string> = {
  LOW: "bg-gray-400",
  NORMAL: "bg-blue-400",
  HIGH: "bg-orange-400",
  URGENT: "bg-red-500",
};

export function ConversationList({ activeId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["conversations", statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/chat/conversations?${params}`);
      const d = await res.json();
      return d.data as Conversation[];
    },
    refetchInterval: 15000,
  });

  return (
    <div className="w-80 flex flex-col border-r bg-gray-50 shrink-0">
      <div className="p-4 border-b bg-white space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Conversations</h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conversations</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-2 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <p className="text-sm">No conversations found</p>
          </div>
        )}

        {data?.map((conv) => (
          <button
            key={conv._id}
            onClick={() => onSelect(conv._id)}
            className={cn(
              "w-full text-left p-4 border-b border-gray-100 hover:bg-white transition-colors",
              activeId === conv._id && "bg-indigo-50 border-l-2 border-l-indigo-500"
            )}
          >
            <div className="flex items-start gap-3">
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-medium">
                  {getInitials(conv.visitor?.name || conv.visitor?.email || "V")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {conv.visitor?.name || conv.visitor?.email || "Anonymous"}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">
                    {conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : timeAgo(conv.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", statusColors[conv.status])}>
                    {conv.status}
                  </span>
                  <div className={cn("w-1.5 h-1.5 rounded-full", priorityDot[conv.priority])} title={conv.priority} />
                  <span className="text-xs text-gray-400">{conv.messageCount} msgs</span>
                </div>
                {conv.assignedTo && (
                  <p className="text-xs text-gray-400 mt-1 truncate">→ {conv.assignedTo.name}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
