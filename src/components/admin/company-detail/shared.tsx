"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  RCS: "RCS",
  EMAIL: "Email",
};

export const CHANNEL_COLORS: Record<string, string> = {
  WHATSAPP: "bg-green-100 text-green-700",
  RCS: "bg-blue-100 text-blue-700",
  EMAIL: "bg-purple-100 text-purple-700",
};

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SCHEDULED: "bg-blue-100 text-blue-700",
  RUNNING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELED: "bg-gray-100 text-gray-500",
};

export const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  QUEUED: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-teal-100 text-teal-700",
  READ: "bg-indigo-100 text-indigo-700",
  OPENED: "bg-indigo-100 text-indigo-700",
  CLICKED: "bg-violet-100 text-violet-700",
  BOUNCED: "bg-orange-100 text-orange-700",
  COMPLAINED: "bg-orange-100 text-orange-700",
  UNDELIVERED: "bg-orange-100 text-orange-700",
  FAILED: "bg-red-100 text-red-700",
};

export interface ChannelCampaignStats {
  campaigns: number;
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  readOrOpened: number;
  clicked: number;
  pending: number;
  bounced?: number;
  conversationsWithReplies?: number;
  unsubscribed?: number;
}

export interface CompanyCampaignStats {
  totalCampaigns: number;
  whatsappCampaigns: number;
  rcsCampaigns: number;
  emailCampaigns: number;
  totalRecipients: number;
  totalSent: number;
  delivered: number;
  failed: number;
  pending: number;
  readOrOpened: number;
  clicked: number;
  unsubscribed: number;
  activeCampaigns: number;
  byChannel: { whatsapp: ChannelCampaignStats; rcs: ChannelCampaignStats; email: ChannelCampaignStats };
}

export function ChannelBadge({ channel }: { channel: string }) {
  return <Badge className={cn("font-normal", CHANNEL_COLORS[channel] || "bg-gray-100 text-gray-600")}>{CHANNEL_LABELS[channel] || channel}</Badge>;
}

export function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
  return <Badge className={cn("font-normal", map[status] || "bg-gray-100 text-gray-600")}>{status}</Badge>;
}

export function formatDate(d?: string | Date | null) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(d?: string | Date | null) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-1 py-2">
      <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function UnavailableNotice({ reason }: { reason: string }) {
  return (
    <div className="text-center py-10 px-4 border border-dashed rounded-lg bg-gray-50">
      <p className="text-sm font-medium text-gray-700">Not available for this channel</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">{reason}</p>
    </div>
  );
}

// Distinct from an empty-state — a failed request should never look identical to
// "there's genuinely no data here" (that's the same principle behind not showing
// fake zeros for untracked metrics).
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <p className="text-sm font-medium text-gray-700">Couldn&apos;t load this data</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{message || "Something went wrong talking to the server. Please try again."}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4 h-7 text-xs" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export interface DateRangeValue {
  preset: string;
  dateFrom?: string;
  dateTo?: string;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export const DATE_PRESETS: Record<string, () => { dateFrom?: string; dateTo?: string }> = {
  all: () => ({}),
  today: () => ({ dateFrom: startOfDay(new Date()).toISOString(), dateTo: endOfDay(new Date()).toISOString() }),
  yesterday: () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return { dateFrom: startOfDay(y).toISOString(), dateTo: endOfDay(y).toISOString() };
  },
  last7: () => {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return { dateFrom: startOfDay(from).toISOString(), dateTo: endOfDay(new Date()).toISOString() };
  },
  last30: () => {
    const from = new Date();
    from.setDate(from.getDate() - 29);
    return { dateFrom: startOfDay(from).toISOString(), dateTo: endOfDay(new Date()).toISOString() };
  },
  thisMonth: () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: startOfDay(from).toISOString(), dateTo: endOfDay(now).toISOString() };
  },
};

const PRESET_LABELS: Record<string, string> = {
  all: "All time",
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  thisMonth: "This month",
  custom: "Custom range",
};

export function DateRangeFilter({ value, onChange }: { value: DateRangeValue; onChange: (value: DateRangeValue) => void }) {
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const handlePreset = (preset: string) => {
    if (preset === "custom") {
      onChange({ preset, dateFrom: customFrom ? new Date(customFrom).toISOString() : undefined, dateTo: customTo ? endOfDay(new Date(customTo)).toISOString() : undefined });
      return;
    }
    onChange({ preset, ...DATE_PRESETS[preset]() });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={value.preset} onValueChange={handlePreset}>
        <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Date range" /></SelectTrigger>
        <SelectContent>
          {Object.entries(PRESET_LABELS).map(([k, label]) => (
            <SelectItem key={k} value={k}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.preset === "custom" && (
        <div className="flex items-center gap-1">
          <Input type="date" className="h-9 w-[135px] text-xs" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); onChange({ preset: "custom", dateFrom: e.target.value ? new Date(e.target.value).toISOString() : undefined, dateTo: customTo ? endOfDay(new Date(customTo)).toISOString() : undefined }); }} />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" className="h-9 w-[135px] text-xs" value={customTo} onChange={(e) => { setCustomTo(e.target.value); onChange({ preset: "custom", dateFrom: customFrom ? new Date(customFrom).toISOString() : undefined, dateTo: e.target.value ? endOfDay(new Date(e.target.value)).toISOString() : undefined }); }} />
        </div>
      )}
    </div>
  );
}
