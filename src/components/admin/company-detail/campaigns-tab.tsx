"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Eye, Users } from "lucide-react";
import { EmptyState } from "@/components/whatsapp/empty-state";
import { Megaphone } from "lucide-react";
import { ChannelBadge, StatusBadge, CAMPAIGN_STATUS_COLORS, formatDate, Pagination } from "./shared";

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
  createdAt: string;
}

const STATUS_OPTIONS = ["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "CANCELED"];

export function CampaignsTab({ companyId }: { companyId: string }) {
  const [channel, setChannel] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-company-campaigns", companyId, channel, status, search, page],
    queryFn: () =>
      axios
        .get(`/api/admin/companies/${companyId}/campaigns`, {
          params: {
            channel: channel === "all" ? undefined : channel,
            status: status === "all" ? undefined : status,
            search: search || undefined,
            page,
            limit: 20,
          },
        })
        .then((r) => r.data.data),
  });

  const items: NormalizedCampaign[] = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaign name..."
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
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={Megaphone} title="No campaigns found" description="No campaigns match the current filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
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
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => (
                      <tr key={`${c.channel}-${c._id}`} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium max-w-[220px] truncate">{c.name}</td>
                        <td className="px-4 py-2.5"><ChannelBadge channel={c.channel} /></td>
                        <td className="px-4 py-2.5 text-right">{c.recipients}</td>
                        <td className="px-4 py-2.5 text-right">{c.sent}</td>
                        <td className="px-4 py-2.5 text-right text-teal-600">{c.delivered}</td>
                        <td className="px-4 py-2.5 text-right text-red-600">{c.failed}</td>
                        <td className="px-4 py-2.5 text-right text-violet-600">{c.readOrOpened}</td>
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
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
