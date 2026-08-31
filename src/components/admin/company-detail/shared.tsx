"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
