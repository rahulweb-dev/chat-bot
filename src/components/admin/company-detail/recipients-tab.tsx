"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Users } from "lucide-react";
import { EmptyState } from "@/components/whatsapp/empty-state";
import { ChannelBadge, StatusBadge, RECIPIENT_STATUS_COLORS, formatDateTime, Pagination, ErrorState, DateRangeFilter, DateRangeValue } from "./shared";
import { ContactDetailDialog } from "./contact-detail-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface Recipient {
  _id: string;
  channel: "WHATSAPP" | "RCS" | "EMAIL";
  campaignName: string;
  status: string;
  phone?: string;
  email?: string;
  contactId: string;
  contactName?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  openedAt?: string;
  createdAt: string;
}

export function RecipientsTab({ companyId }: { companyId: string }) {
  const [channel, setChannel] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ preset: "all" });
  const [selectedContact, setSelectedContact] = useState<{ id: string; channel: "WHATSAPP" | "RCS" | "EMAIL" } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-company-recipients", companyId, channel, debouncedSearch, page, dateRange.dateFrom, dateRange.dateTo],
    queryFn: () =>
      axios
        .get(`/api/admin/companies/${companyId}/campaigns/recipients`, {
          params: {
            channel: channel === "all" ? undefined : channel,
            search: debouncedSearch || undefined,
            dateFrom: dateRange.dateFrom,
            dateTo: dateRange.dateTo,
            page,
            limit: 50,
          },
        })
        .then((r) => r.data.data as { items: Recipient[]; total: number; page: number; totalPages: number }),
  });

  const items = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-45">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search phone or email..."
            className="pl-8 h-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-35"><SelectValue placeholder="Channel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
            <SelectItem value="RCS">RCS</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
          </SelectContent>
        </Select>
        <DateRangeFilter value={dateRange} onChange={(v) => { setDateRange(v); setPage(1); }} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <ErrorState message="Couldn't load recipients." onRetry={() => refetch()} />
          ) : items.length === 0 ? (
            <EmptyState icon={Users} title="No recipients found" description="No recipients match the current filters." />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
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
                        <td className="px-4 py-2.5 font-medium">
                          <button className="hover:text-indigo-600 hover:underline" onClick={() => setSelectedContact({ id: r.contactId, channel: r.channel })}>
                            {r.contactName || "—"}
                          </button>
                        </td>
                        <td className="px-4 py-2.5"><ChannelBadge channel={r.channel} /></td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.email || r.phone || "—"}</td>
                        <td className="px-4 py-2.5 max-w-45 truncate">{r.campaignName}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={r.status} map={RECIPIENT_STATUS_COLORS} /></td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.sentAt)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.deliveredAt)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.readAt || r.openedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {items.map((r) => (
                  <button
                    key={`${r.channel}-${r._id}`}
                    className="w-full text-left p-3 space-y-1.5"
                    onClick={() => setSelectedContact({ id: r.contactId, channel: r.channel })}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{r.contactName || r.email || r.phone || "—"}</span>
                      <ChannelBadge channel={r.channel} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{r.campaignName}</p>
                    <div className="flex items-center justify-between">
                      <StatusBadge status={r.status} map={RECIPIENT_STATUS_COLORS} />
                      <span className="text-xs text-muted-foreground">{formatDateTime(r.sentAt)}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="px-4">
                <Pagination page={data?.page || 1} totalPages={data?.totalPages || 1} onChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ContactDetailDialog
        companyId={companyId}
        channel={selectedContact?.channel || "WHATSAPP"}
        contactId={selectedContact?.id || null}
        open={!!selectedContact}
        onOpenChange={(open) => !open && setSelectedContact(null)}
      />
    </div>
  );
}
