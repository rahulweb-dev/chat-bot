"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, MessageCircle, User as UserIcon } from "lucide-react";
import { ChannelBadge, StatusBadge, RECIPIENT_STATUS_COLORS, formatDateTime, ErrorState } from "./shared";

interface CampaignHistoryRow {
  campaignId: string;
  campaignName: string;
  status: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  openedAt?: string;
  clickedAt?: string;
  error?: string;
}

interface ConversationMessage {
  direction: "INBOUND" | "OUTBOUND";
  content?: string;
  messageType: string;
  createdAt: string;
}

export function ContactDetailDialog({
  companyId,
  channel,
  contactId,
  open,
  onOpenChange,
}: {
  companyId: string;
  channel: "WHATSAPP" | "RCS" | "EMAIL";
  contactId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-contact-detail", companyId, contactId, channel],
    queryFn: () =>
      axios
        .get(`/api/admin/companies/${companyId}/contacts/${contactId}`, { params: { channel } })
        .then((r) => r.data.data as {
          contact: { name?: string; phone?: string; email?: string; tags?: string[]; optIn: boolean; createdAt: string };
          campaignHistory: CampaignHistoryRow[];
          conversation: { conversationId: string; status: string; messages: ConversationMessage[] } | null;
        }),
    enabled: open && !!contactId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            Contact Activity
            <ChannelBadge channel={channel} />
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : isError || !data ? (
          <ErrorState message="Couldn't load this contact's activity." onRetry={() => refetch()} />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm border rounded-lg p-3">
              <Field label="Name" value={data.contact.name || "—"} />
              <Field label={channel === "EMAIL" ? "Email" : "Phone"} value={data.contact.email || data.contact.phone || "—"} />
              <Field label="Opt-in" value={data.contact.optIn ? "Yes" : "No"} />
              <Field label="Tags" value={data.contact.tags?.length ? data.contact.tags.join(", ") : "—"} />
              <Field label="Added" value={formatDateTime(data.contact.createdAt)} />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Campaign History ({data.campaignHistory.length})</p>
              {data.campaignHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No campaigns sent to this contact yet.</p>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground bg-gray-50">
                        <th className="px-3 py-1.5 font-medium">Campaign</th>
                        <th className="px-3 py-1.5 font-medium">Status</th>
                        <th className="px-3 py-1.5 font-medium">Sent</th>
                        <th className="px-3 py-1.5 font-medium">Delivered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.campaignHistory.map((h, i) => (
                        <tr key={`${h.campaignId}-${i}`} className="border-b last:border-0">
                          <td className="px-3 py-1.5 max-w-[160px] truncate">{h.campaignName}</td>
                          <td className="px-3 py-1.5"><StatusBadge status={h.status} map={RECIPIENT_STATUS_COLORS} /></td>
                          <td className="px-3 py-1.5 text-muted-foreground">{formatDateTime(h.sentAt)}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{formatDateTime(h.deliveredAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {channel === "WHATSAPP" && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" /> Conversation
                </p>
                {!data.conversation ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No conversation with this contact.</p>
                ) : data.conversation.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No messages yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                    {data.conversation.messages.map((m, i) => (
                      <div key={i} className={`flex ${m.direction === "INBOUND" ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${m.direction === "INBOUND" ? "bg-white border" : "bg-indigo-600 text-white"}`}>
                          <p>{m.content || `(${m.messageType.toLowerCase()} message)`}</p>
                          <p className={`text-[10px] mt-0.5 ${m.direction === "INBOUND" ? "text-muted-foreground" : "text-indigo-100"}`}>{formatDateTime(m.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}
