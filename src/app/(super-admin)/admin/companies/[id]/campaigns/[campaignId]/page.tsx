"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowLeft, Loader2, Search, Send, CheckCheck, XCircle, Eye, MousePointerClick, Clock, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/whatsapp/empty-state";
import {
  ChannelBadge,
  StatusBadge,
  RECIPIENT_STATUS_COLORS,
  CAMPAIGN_STATUS_COLORS,
  formatDateTime,
  Pagination,
  UnavailableNotice,
  ErrorState,
} from "@/components/admin/company-detail/shared";
import { ContactDetailDialog } from "@/components/admin/company-detail/contact-detail-dialog";

type Channel = "WHATSAPP" | "RCS" | "EMAIL";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "recipients", label: "Recipients" },
  { id: "analytics", label: "Analytics" },
  { id: "replies", label: "Messages / Replies" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function CampaignDetailInner() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;
  const campaignId = params.campaignId as string;
  const searchParams = useSearchParams();
  const channel = ((searchParams.get("channel") || "").toUpperCase() || "WHATSAPP") as Channel;
  const tabParam = searchParams.get("tab") as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "overview");

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    router.replace(`/admin/companies/${companyId}/campaigns/${campaignId}?channel=${channel}&tab=${id}`, { scroll: false });
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-campaign-detail", companyId, campaignId, channel],
    queryFn: () =>
      axios
        .get(`/api/admin/companies/${companyId}/campaigns/${campaignId}`, { params: { channel } })
        .then((r) => r.data.data),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (isError) {
    return <div className="p-6"><ErrorState message="Couldn't load this campaign." onRetry={() => refetch()} /></div>;
  }
  if (!data) {
    return <div className="p-6"><p className="text-sm text-muted-foreground">Campaign not found.</p></div>;
  }

  const { campaign, performance, rates } = data as {
    campaign: Record<string, unknown> & { name: string; status: string; createdAt: string; scheduledAt?: string; startedAt?: string; completedAt?: string };
    performance: { total: number; sent: number; delivered: number; failed: number; pending: number; readOrOpened: number; clicked: number; bounced: number };
    rates: Record<string, number>;
  };

  const readLabel = channel === "EMAIL" ? "Opened" : "Read";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/companies/${companyId}?tab=campaigns`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{campaign.name}</h1>
            <ChannelBadge channel={channel} />
            <StatusBadge status={campaign.status} map={CAMPAIGN_STATUS_COLORS} />
          </div>
          <p className="text-muted-foreground text-sm">Campaign ID: {campaignId}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={cn(
              "px-4 h-11 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
              activeTab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Overview</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Name" value={campaign.name} />
                <Row label="Channel" value={channel} />
                <Row label="Status" value={campaign.status} />
                {channel === "WHATSAPP" && <Row label="Template" value={(campaign.templateName as string) || "—"} />}
                {channel === "RCS" && <Row label="Message" value={(campaign.body as string) || "—"} />}
                {channel === "EMAIL" && <Row label="Subject" value={(campaign.subject as string) || "—"} />}
                <Row label="Created" value={formatDateTime(campaign.createdAt)} />
                <Row label="Scheduled" value={formatDateTime(campaign.scheduledAt)} />
                <Row label="Started" value={formatDateTime(campaign.startedAt)} />
                <Row label="Completed" value={formatDateTime(campaign.completedAt)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Performance</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Metric icon={Send} label="Recipients" value={performance.total} color="text-indigo-500" />
                <Metric icon={Send} label="Sent" value={performance.sent} color="text-sky-500" />
                <Metric icon={CheckCheck} label="Delivered" value={performance.delivered} color="text-teal-500" />
                <Metric icon={XCircle} label="Failed" value={performance.failed} color="text-red-500" />
                <Metric icon={Clock} label="Pending" value={performance.pending} color="text-amber-500" />
                <Metric icon={Eye} label={readLabel} value={performance.readOrOpened} color="text-violet-500" />
                {(channel === "RCS" || channel === "EMAIL") && <Metric icon={MousePointerClick} label="Clicked" value={performance.clicked} color="text-fuchsia-500" />}
                {channel === "EMAIL" && <Metric icon={XCircle} label="Bounced" value={performance.bounced} color="text-orange-500" />}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Rates</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(rates).map(([key, value]) => (
                <div key={key} className="text-center border rounded-lg py-3">
                  <p className="text-2xl font-bold">{value}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{rateLabel(key)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "recipients" && <RecipientsSection companyId={companyId} campaignId={campaignId} channel={channel} />}
      {activeTab === "analytics" && <AnalyticsSection channel={channel} performance={performance} readLabel={readLabel} />}
      {activeTab === "replies" && <RepliesSection companyId={companyId} campaignId={campaignId} channel={channel} />}
    </div>
  );
}

function rateLabel(key: string) {
  const map: Record<string, string> = {
    deliveryRate: "Delivery Rate",
    failureRate: "Failure Rate",
    readRate: "Read Rate",
    openRate: "Open Rate",
    clickRate: "Click Rate",
    bounceRate: "Bounce Rate",
  };
  return map[key] || key;
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[70%] break-words">{value || "—"}</span>
    </div>
  );
}

function Metric({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        {label}
      </div>
      <p className="text-xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

function AnalyticsSection({
  channel,
  performance,
  readLabel,
}: {
  channel: Channel;
  performance: { sent: number; delivered: number; failed: number; readOrOpened: number; clicked: number };
  readLabel: string;
}) {
  const funnel = [
    { stage: "Sent", value: performance.sent },
    { stage: "Delivered", value: performance.delivered },
    { stage: readLabel, value: performance.readOrOpened },
    ...(channel !== "WHATSAPP" ? [{ stage: "Clicked", value: performance.clicked }] : []),
    { stage: "Failed", value: performance.failed },
  ];

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Funnel</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={funnel}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function RecipientsSection({ companyId, campaignId, channel }: { companyId: string; campaignId: string; channel: Channel }) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const statusOptions =
    channel === "EMAIL"
      ? ["PENDING", "QUEUED", "SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "COMPLAINED", "FAILED"]
      : channel === "RCS"
      ? ["PENDING", "QUEUED", "SENT", "DELIVERED", "READ", "FAILED", "UNDELIVERED"]
      : ["PENDING", "QUEUED", "SENT", "DELIVERED", "READ", "FAILED"];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-campaign-recipients", companyId, campaignId, channel, status, search, page],
    queryFn: () =>
      axios
        .get(`/api/admin/companies/${companyId}/campaigns/${campaignId}/recipients`, {
          params: { channel, status: status === "all" ? undefined : status, search: search || undefined, page, limit: 50 },
        })
        .then((r) => r.data),
  });

  const items: Array<Record<string, unknown> & { _id: string; status: string; contactId?: { _id: string; name?: string } | null; phone?: string; email?: string; sentAt?: string; deliveredAt?: string; readAt?: string; openedAt?: string; clickedAt?: string }> = data?.data || [];
  const meta = data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-45">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search phone or email..." className="pl-8 h-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-37.5"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <ErrorState message="Couldn't load recipients." onRetry={() => refetch()} />
          ) : items.length === 0 ? (
            <EmptyState icon={Send} title="No recipients" description="No recipients match the current filters." />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Contact</th>
                      <th className="px-4 py-2 font-medium">Email / Phone</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Sent</th>
                      <th className="px-4 py-2 font-medium">Delivered</th>
                      <th className="px-4 py-2 font-medium">{channel === "EMAIL" ? "Opened" : "Read"}</th>
                      {channel !== "WHATSAPP" && <th className="px-4 py-2 font-medium">Clicked</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r._id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">
                          {r.contactId?._id ? (
                            <button className="hover:text-indigo-600 hover:underline" onClick={() => setSelectedContactId(r.contactId!._id)}>
                              {r.contactId.name || "—"}
                            </button>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.email || r.phone || "—"}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={r.status} map={RECIPIENT_STATUS_COLORS} /></td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.sentAt)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.deliveredAt)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.readAt || r.openedAt)}</td>
                        {channel !== "WHATSAPP" && <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.clickedAt)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {items.map((r) => (
                  <button
                    key={r._id}
                    className="w-full text-left p-3 space-y-1.5"
                    onClick={() => r.contactId?._id && setSelectedContactId(r.contactId._id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{r.contactId?.name || r.email || r.phone || "—"}</span>
                      <StatusBadge status={r.status} map={RECIPIENT_STATUS_COLORS} />
                    </div>
                    <p className="text-xs text-muted-foreground">{r.email || r.phone}</p>
                    <p className="text-xs text-muted-foreground">Sent {formatDateTime(r.sentAt)}</p>
                  </button>
                ))}
              </div>

              <div className="px-4"><Pagination page={meta?.page || 1} totalPages={meta?.pages || 1} onChange={setPage} /></div>
            </>
          )}
        </CardContent>
      </Card>

      <ContactDetailDialog
        companyId={companyId}
        channel={channel}
        contactId={selectedContactId}
        open={!!selectedContactId}
        onOpenChange={(open) => !open && setSelectedContactId(null)}
      />
    </div>
  );
}

function RepliesSection({ companyId, campaignId, channel }: { companyId: string; campaignId: string; channel: Channel }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-campaign-replies", companyId, campaignId, channel],
    queryFn: () =>
      axios
        .get(`/api/admin/companies/${companyId}/campaigns/${campaignId}/replies`, { params: { channel } })
        .then((r) => r.data.data as { available: boolean; reason?: string; truncated?: boolean; recipientsScanned?: number; totalRecipients?: number; replies: Array<Record<string, unknown> & { contactId: string; name?: string; phone: string; conversationStatus: string; firstReplyAt: string; lastReplyAt: string; replyCount: number; latestReplyText?: string }> }),
  });

  if (isLoading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (isError) return <ErrorState message="Couldn't load replies." onRetry={() => refetch()} />;
  if (!data) return null;

  if (!data.available) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0"><ChannelBadge channel={channel} /><CardTitle className="text-base">Replies</CardTitle></CardHeader>
        <CardContent><UnavailableNotice reason={data.reason || "Reply tracking is not available for this channel."} /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0"><ChannelBadge channel={channel} /><CardTitle className="text-base">Conversation Replies</CardTitle></CardHeader>
      {data.truncated && (
        <p className="text-xs text-amber-700 bg-amber-50 border-t border-b px-4 py-2">
          This campaign has {data.totalRecipients} recipients — reply detection only scanned the first {data.recipientsScanned}. Some replies may not be reflected here.
        </p>
      )}
      <CardContent className="p-0">
        {data.replies.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No replies yet" description="No recipients have replied to this campaign." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Contact</th>
                    <th className="px-4 py-2 font-medium">Phone</th>
                    <th className="px-4 py-2 font-medium">Latest Reply</th>
                    <th className="px-4 py-2 font-medium">Reply Count</th>
                    <th className="px-4 py-2 font-medium">Conversation Status</th>
                    <th className="px-4 py-2 font-medium">First Reply</th>
                    <th className="px-4 py-2 font-medium">Last Reply</th>
                  </tr>
                </thead>
                <tbody>
                  {data.replies.map((r) => (
                    <tr key={r.contactId} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium">{r.name || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.phone}</td>
                      <td className="px-4 py-2.5 max-w-60 truncate text-muted-foreground">{r.latestReplyText || "—"}</td>
                      <td className="px-4 py-2.5">{r.replyCount}</td>
                      <td className="px-4 py-2.5">{r.conversationStatus}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.firstReplyAt)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(r.lastReplyAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {data.replies.map((r) => (
                <div key={r.contactId} className="p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{r.name || r.phone}</span>
                    <span className="text-xs text-muted-foreground">{r.replyCount} {r.replyCount === 1 ? "reply" : "replies"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{r.latestReplyText || "—"}</p>
                  <p className="text-xs text-muted-foreground">Last reply {formatDateTime(r.lastReplyAt)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function CampaignDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <CampaignDetailInner />
    </Suspense>
  );
}
