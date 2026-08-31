"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Search, Eye, Users, Copy, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/whatsapp/empty-state";
import { Megaphone } from "lucide-react";
import { ChannelBadge, StatusBadge, CAMPAIGN_STATUS_COLORS, formatDate, Pagination, ErrorState, DateRangeFilter, DateRangeValue } from "./shared";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface NormalizedCampaign {
  _id: string;
  channel: "WHATSAPP" | "RCS" | "EMAIL";
  name: string;
  status: string;
  recipients: number;
  sent: number;
  delivered: number;
  failed: number;
  readOrOpened: number;
  clicked: number;
  replies: number | null;
  createdAt: string;
}

const STATUS_OPTIONS = ["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "CANCELED"];

export function CampaignsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ preset: "all" });

  const queryKey = ["admin-company-campaigns", companyId, channel, status, debouncedSearch, page, dateRange.dateFrom, dateRange.dateTo];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      axios
        .get(`/api/admin/companies/${companyId}/campaigns`, {
          params: {
            channel: channel === "all" ? undefined : channel,
            status: status === "all" ? undefined : status,
            search: debouncedSearch || undefined,
            dateFrom: dateRange.dateFrom,
            dateTo: dateRange.dateTo,
            page,
            limit: 20,
          },
        })
        .then((r) => r.data.data),
    refetchInterval: 20000,
  });

  const duplicate = useMutation({
    mutationFn: ({ id, ch }: { id: string; ch: string }) =>
      axios.post(`/api/admin/companies/${companyId}/campaigns/${id}/duplicate`, {}, { params: { channel: ch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-company-campaigns", companyId] });
      qc.invalidateQueries({ queryKey: ["admin-company-campaign-stats", companyId] });
      toast({ title: "Campaign duplicated as a draft" });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to duplicate campaign";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: ({ id, ch }: { id: string; ch: string }) =>
      axios.delete(`/api/admin/companies/${companyId}/campaigns/${id}`, { params: { channel: ch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-company-campaigns", companyId] });
      qc.invalidateQueries({ queryKey: ["admin-company-campaign-stats", companyId] });
      toast({ title: "Campaign deleted" });
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to delete campaign";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const items: NormalizedCampaign[] = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-45">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaign name..."
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
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-37.5"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <DateRangeFilter value={dateRange} onChange={(v) => { setDateRange(v); setPage(1); }} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <ErrorState message="Couldn't load campaigns." onRetry={() => refetch()} />
          ) : items.length === 0 ? (
            <EmptyState icon={Megaphone} title="No campaigns found" description="No campaigns match the current filters." />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Campaign</th>
                      <th className="px-4 py-2 font-medium">Channel</th>
                      <th className="px-4 py-2 font-medium text-right">Recipients</th>
                      <th className="px-4 py-2 font-medium text-right">Sent</th>
                      <th className="px-4 py-2 font-medium text-right">Delivered</th>
                      <th className="px-4 py-2 font-medium text-right">Failed</th>
                      <th className="px-4 py-2 font-medium text-right">Read/Open</th>
                      <th className="px-4 py-2 font-medium text-right">Replies</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => (
                      <tr key={`${c.channel}-${c._id}`} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium max-w-55 truncate">{c.name}</td>
                        <td className="px-4 py-2.5"><ChannelBadge channel={c.channel} /></td>
                        <td className="px-4 py-2.5 text-right">{c.recipients}</td>
                        <td className="px-4 py-2.5 text-right">{c.sent}</td>
                        <td className="px-4 py-2.5 text-right text-teal-600">{c.delivered}</td>
                        <td className="px-4 py-2.5 text-right text-red-600">{c.failed}</td>
                        <td className="px-4 py-2.5 text-right text-violet-600">{c.readOrOpened}</td>
                        <td className="px-4 py-2.5 text-right text-fuchsia-600">{c.replies === null ? "—" : c.replies}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={c.status} map={CAMPAIGN_STATUS_COLORS} /></td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDate(c.createdAt)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <Link href={`/admin/companies/${companyId}/campaigns/${c._id}?channel=${c.channel}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="View campaign"><Eye className="h-3.5 w-3.5" /></Button>
                            </Link>
                            <Link href={`/admin/companies/${companyId}/campaigns/${c._id}?channel=${c.channel}&tab=recipients`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="View recipients"><Users className="h-3.5 w-3.5" /></Button>
                            </Link>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7" aria-label="Duplicate campaign"
                              disabled={duplicate.isPending}
                              onClick={() => duplicate.mutate({ id: c._id, ch: c.channel })}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" aria-label="Delete campaign" disabled={c.status === "RUNNING"}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete &quot;{c.name}&quot;?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This permanently removes the campaign and all its recipient records. This can&apos;t be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => remove.mutate({ id: c._id, ch: c.channel })}>Delete Campaign</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {items.map((c) => (
                  <div key={`${c.channel}-${c._id}`} className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{c.name}</span>
                      <ChannelBadge channel={c.channel} />
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status} map={CAMPAIGN_STATUS_COLORS} />
                      <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs text-center">
                      <div><p className="font-semibold">{c.sent}</p><p className="text-muted-foreground">Sent</p></div>
                      <div><p className="font-semibold text-teal-600">{c.delivered}</p><p className="text-muted-foreground">Delivered</p></div>
                      <div><p className="font-semibold text-red-600">{c.failed}</p><p className="text-muted-foreground">Failed</p></div>
                      <div><p className="font-semibold text-violet-600">{c.readOrOpened}</p><p className="text-muted-foreground">Read</p></div>
                    </div>
                    <div className="flex justify-end gap-1 pt-1">
                      <Link href={`/admin/companies/${companyId}/campaigns/${c._id}?channel=${c.channel}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs"><Eye className="h-3 w-3 mr-1" />View</Button>
                      </Link>
                      <Button variant="outline" size="sm" className="h-7 text-xs" disabled={duplicate.isPending} onClick={() => duplicate.mutate({ id: c._id, ch: c.channel })}>
                        <Copy className="h-3 w-3 mr-1" />Duplicate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4">
                <Pagination page={data?.page || 1} totalPages={data?.totalPages || 1} onChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
