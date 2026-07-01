"use client";
import { useQuery } from "@tanstack/react-query";
import { Search, RefreshCw, Clock, CheckSquare, Square, CheckCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, timeAgo, getInitials } from "@/lib/utils";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChatStore } from "@/store/chat-store";
import { toast } from "@/hooks/use-toast";

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
  OPEN:     "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-green-100 text-green-700",
  PENDING:  "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-gray-100 text-gray-700",
  CLOSED:   "bg-red-100 text-red-700",
};

const priorityDot: Record<string, string> = {
  LOW:    "bg-gray-400",
  NORMAL: "bg-blue-400",
  HIGH:   "bg-orange-400",
  URGENT: "bg-red-500 animate-pulse",
};

function waitingMinutes(lastMessageAt?: string): number {
  if (!lastMessageAt) return 0;
  return Math.floor((Date.now() - new Date(lastMessageAt).getTime()) / 60_000);
}

function WaitingBadge({ lastMessageAt, status }: { lastMessageAt?: string; status: string }) {
  if (!lastMessageAt || status === "RESOLVED" || status === "CLOSED") return null;
  const mins = waitingMinutes(lastMessageAt);
  if (mins < 1) return null;
  const color = mins >= 10 ? "bg-red-100 text-red-700" : mins >= 3 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500";
  return (
    <span className={cn("flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full", color)}>
      <Clock className="w-2.5 h-2.5" />
      {mins >= 60 ? `${Math.floor(mins / 60)}h` : `${mins}m`}
    </span>
  );
}

export function ConversationList({ activeId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const { unreadCounts } = useChatStore();

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
    refetchInterval: 10000,
  });

  const allIds = data?.map((c) => c._id) || [];
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkAction = async (action: string) => {
    if (!selectedIds.size) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/chat/conversations/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action }),
      });
      const d = await res.json();
      if (d.success) {
        toast({ title: `${d.data.modified} conversation(s) updated` });
        clearSelection();
        refetch();
      } else {
        toast({ title: "Action failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="w-80 flex flex-col border-r bg-gray-50 shrink-0">
      <div className="p-4 border-b bg-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 ? (
              <button onClick={toggleAll} className="text-indigo-600" title={allSelected ? "Deselect all" : "Select all"}>
                {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
            ) : null}
            <h2 className="font-semibold text-gray-900">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Conversations"}
            </h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
              disabled={bulkLoading}
              onClick={() => bulkAction("resolve")}
            >
              <CheckCheck className="w-3 h-3" /> Resolve
            </Button>
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs gap-1 text-gray-600 border-gray-200 hover:bg-gray-100"
              disabled={bulkLoading}
              onClick={() => bulkAction("close")}
            >
              Close
            </Button>
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
              disabled={bulkLoading}
              onClick={() => bulkAction("reopen")}
            >
              Reopen
            </Button>
            <button onClick={clearSelection} className="ml-auto text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
              <div key={i} className="animate-pulse flex gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-200 rounded w-1/2" />
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

        {data?.map((conv) => {
          const unread = unreadCounts[conv._id] || 0;
          const isSelected = selectedIds.has(conv._id);
          return (
            <div
              key={conv._id}
              className={cn(
                "group relative border-b border-gray-100",
                isSelected && "bg-indigo-50"
              )}
            >
              {/* Checkbox overlay — visible on hover or when any selected */}
              <div
                className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 z-10 transition-opacity",
                  selectedIds.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
              >
                <button
                  onClick={(e) => toggleSelect(e, conv._id)}
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                    isSelected
                      ? "bg-indigo-500 border-indigo-500 text-white"
                      : "bg-white border-gray-300 hover:border-indigo-400"
                  )}
                >
                  {isSelected && <CheckCheck className="w-2.5 h-2.5" />}
                </button>
              </div>

              <button
                onClick={() => { clearSelection(); onSelect(conv._id); }}
                className={cn(
                  "w-full text-left p-4 hover:bg-white transition-colors",
                  activeId === conv._id && !isSelected && "bg-indigo-50 border-l-2 border-l-indigo-500",
                  selectedIds.size > 0 && "pl-9"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-medium">
                        {getInitials(conv.visitor?.name || conv.visitor?.email || "V")}
                      </AvatarFallback>
                    </Avatar>
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={cn("text-sm font-medium text-gray-900 truncate", unread > 0 && "font-semibold")}>
                        {conv.visitor?.name || conv.visitor?.email || "Anonymous"}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0 ml-2">
                        {conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : timeAgo(conv.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", statusColors[conv.status])}>
                        {conv.status}
                      </span>
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityDot[conv.priority])} title={conv.priority} />
                      <WaitingBadge lastMessageAt={conv.lastMessageAt} status={conv.status} />
                      <span className="text-xs text-gray-400">{conv.messageCount} msgs</span>
                    </div>
                    {conv.assignedTo && (
                      <p className="text-xs text-gray-400 mt-1 truncate">→ {conv.assignedTo.name}</p>
                    )}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
