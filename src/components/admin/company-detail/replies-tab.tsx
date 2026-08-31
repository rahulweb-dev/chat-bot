"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/whatsapp/empty-state";
import { ChannelBadge, formatDateTime, Pagination, UnavailableNotice, ErrorState } from "./shared";

const CONV_STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-blue-100 text-blue-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

interface Conversation {
  _id: string;
  customerName?: string;
  customerPhone: string;
  status: string;
  lastMessage?: string;
  lastMessageAt?: string;
  assignedAgentId?: { name?: string } | null;
}

export function RepliesTab({ companyId }: { companyId: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-company-replies", companyId, search, page],
    queryFn: () =>
      axios
        .get(`/api/admin/companies/${companyId}/campaigns/replies`, { params: { search: search || undefined, page, limit: 50 } })
        .then((r) => r.data),
  });

  const items: Conversation[] = data?.data || [];
  const meta = data?.pagination;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <ChannelBadge channel="WHATSAPP" />
          <CardTitle className="text-base">Conversations &amp; Replies</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-4 pb-3">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or phone..." className="pl-8 h-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <ErrorState message="Couldn't load conversations." onRetry={() => refetch()} />
          ) : items.length === 0 ? (
            <EmptyState icon={MessageCircle} title="No conversations" description="No WhatsApp conversations found." />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Contact</th>
                      <th className="px-4 py-2 font-medium">Phone</th>
                      <th className="px-4 py-2 font-medium">Last Message</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => (
                      <tr key={c._id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">{c.customerName || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.customerPhone}</td>
                        <td className="px-4 py-2.5 max-w-65 truncate text-muted-foreground">{c.lastMessage || "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-normal ${CONV_STATUS_COLORS[c.status] || "bg-gray-100 text-gray-600"}`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(c.lastMessageAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {items.map((c) => (
                  <div key={c._id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{c.customerName || c.customerPhone}</span>
                      <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-normal ${CONV_STATUS_COLORS[c.status] || "bg-gray-100 text-gray-600"}`}>{c.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.lastMessage || "—"}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(c.lastMessageAt)}</p>
                  </div>
                ))}
              </div>

              <div className="px-4">
                <Pagination page={meta?.page || 1} totalPages={meta?.pages || 1} onChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0"><ChannelBadge channel="RCS" /><CardTitle className="text-base">Replies</CardTitle></CardHeader>
          <CardContent><UnavailableNotice reason="This app's RCS integration (via Twilio) does not capture inbound customer replies — only outbound delivery/read status and opt-out keywords are tracked." /></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0"><ChannelBadge channel="EMAIL" /><CardTitle className="text-base">Replies</CardTitle></CardHeader>
          <CardContent><UnavailableNotice reason="Inbound email replies are not captured by this app — only outbound delivery, open, click, and bounce events from the Resend webhook are tracked." /></CardContent>
        </Card>
      </div>
    </div>
  );
}
