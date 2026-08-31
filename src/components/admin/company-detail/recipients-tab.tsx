"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Users } from "lucide-react";
import { EmptyState } from "@/components/whatsapp/empty-state";
import { ChannelBadge, StatusBadge, RECIPIENT_STATUS_COLORS, formatDateTime, Pagination } from "./shared";

interface Recipient {
  _id: string;
  channel: "WHATSAPP" | "RCS" | "EMAIL";
  campaignName: string;
  status: string;
  phone?: string;
  email?: string;
  contactId?: { name?: string } | null;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  openedAt?: string;
  failedAt?: string;
  createdAt: string;
}

export function RecipientsTab({ companyId }: { companyId: string }) {
  const [channel, setChannel] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-company-recipients", companyId, channel, search, page],
    queryFn: () =>
      axios
        .get(`/api/admin/companies/${companyId}/campaigns/recipients`, {
          params: { channel: channel === "all" ? undefined : channel, search: search || undefined, page, limit: 50 },
        })
        .then((r) => r.data),
  });

  const items: Recipient[] = data?.data || [];
  const meta = data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search phone or email..."
            className="pl-8 h-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Channel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
            <SelectItem value="RCS">RCS</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={Users} title="No recipients found" description="No recipients match the current filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Contact</th>
                      <th className="px-4 py-2 font-medium">Channel</th>
                      <th className="px-4 py-2 font-medium">Email / Phone</th>
                      <th className="px-4 py-2 font-medium">Campaign</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Sent</th>
                      <th className="px-4 py-2 font-medium">Delivered</th>
                      <th className="px-4 py-2 font-medium">Read / Opened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={`${r.channel}-${r._id}`} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">{r.contactId?.name || "—"}</td>
                        <td className="px-4 py-2.5"><ChannelBadge channel={r.channel} /></td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.email || r.phone || "—"}</td>
                        <td className="px-4 py-2.5 max-w-[180px] truncate">{r.campaignName}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={r.status} map={RECIPIENT_STATUS_COLORS} /></td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.sentAt)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.deliveredAt)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.readAt || r.openedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4">
                <Pagination page={meta?.page || 1} totalPages={meta?.pages || 1} onChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
