"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { getInitials, timeAgo } from "@/lib/utils";
import { Globe, MessageCircle, Search, Send, Loader2, Hand, ArrowLeft, Clock, Phone, TrendingUp, Bot } from "lucide-react";

type Channel = "WEB" | "WHATSAPP";
interface InboxItem {
  key: string; name: string; phone?: string; channels: Channel[]; lastMessage?: string; lastMessageAt?: string;
  unread: number; waitingForAgent: boolean; status: string; webConversationId?: string; waConversationId?: string;
}
interface ThreadMessage {
  id: string; channel: Channel; from: "customer" | "team" | "bot" | "system"; content: string; at: string;
  senderName?: string; mediaId?: string; messageType?: string; status?: string;
}
interface Thread {
  name: string; phone?: string; email?: string; source?: string; currentPage?: string;
  web: { conversationId: string; status: string; assignedTo?: string; waitingForAgent: boolean } | null;
  whatsapp: { conversationId: string; status: string; windowOpen: boolean | null; windowClosesAt: string | null } | null;
  messages: ThreadMessage[];
}

const CHANNEL = {
  WEB: { label: "Website", icon: Globe, cls: "text-indigo-600 bg-indigo-50" },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle, cls: "text-green-700 bg-green-50" },
} as const;

function ChannelChip({ c }: { c: Channel }) {
  const C = CHANNEL[c];
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded ${C.cls}`}>
      <C.icon className="w-3 h-3" />{C.label}
    </span>
  );
}

// One inbox for website chat and WhatsApp: one row per customer, the full
// history across both channels, reply on either.
export default function InboxPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "all">("open");
  const [search, setSearch] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [chosenChannel, setChosenChannel] = useState<Channel | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["inbox", status, search],
    queryFn: async () => {
      const r = await fetch(`/api/inbox?status=${status}&search=${encodeURIComponent(search)}`);
      return ((await r.json()).data ?? []) as InboxItem[];
    },
    refetchInterval: 8000,
  });

  const { data: thread, isLoading: threadLoading } = useQuery({
    queryKey: ["inbox-thread", activeKey],
    enabled: !!activeKey,
    queryFn: async () => {
      const r = await fetch(`/api/inbox/thread?key=${encodeURIComponent(activeKey!)}`);
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      return d.data as Thread;
    },
    refetchInterval: 5000,
  });

  // Reply on the channel the customer last wrote from, unless the agent picked one.
  const lastCustomerChannel = useMemo(
    () => [...(thread?.messages ?? [])].reverse().find((m) => m.from === "customer")?.channel,
    [thread]
  );
  const available: Channel[] = [...(thread?.web ? ["WEB" as const] : []), ...(thread?.whatsapp ? ["WHATSAPP" as const] : [])];
  const channel: Channel | undefined =
    chosenChannel && available.includes(chosenChannel) ? chosenChannel : lastCustomerChannel && available.includes(lastCustomerChannel) ? lastCustomerChannel : available[0];
  const waClosed = channel === "WHATSAPP" && thread?.whatsapp?.windowOpen === false;

  const msgCount = thread?.messages.length ?? 0;
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgCount, activeKey]);

  function open(key: string) {
    setActiveKey(key);
    setChosenChannel(null);
    setText("");
  }

  async function send() {
    const content = text.trim();
    if (!content || !thread || !channel || waClosed) return;
    setSending(true);
    try {
      const url = channel === "WEB"
        ? `/api/chat/conversations/${thread.web!.conversationId}/messages`
        : `/api/whatsapp/conversations/${thread.whatsapp!.conversationId}/messages`;
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) throw new Error(d.error || "Couldn't send");
      setText("");
      qc.invalidateQueries({ queryKey: ["inbox-thread", activeKey] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Couldn't send", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-[calc(100vh-9rem)] min-h-[520px] flex bg-white rounded-2xl ring-1 ring-black/5 overflow-hidden">
      {/* List */}
      <aside className={`${activeKey ? "hidden md:flex" : "flex"} w-full md:w-80 lg:w-96 shrink-0 flex-col border-r`}>
        <div className="p-4 space-y-3 border-b">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Inbox</h1>
            <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
              {(["open", "all"] as const).map((s) => (
                <button key={s} onClick={() => setStatus(s)} className={`px-2.5 py-1 rounded-md capitalize ${status === s ? "bg-white shadow font-medium" : "text-gray-500"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, number or message" className="pl-9" aria-label="Search conversations" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && <div className="p-4 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>}
          {!isLoading && !items?.length && (
            <p className="p-6 text-sm text-gray-500 text-center">No {status === "open" ? "open " : ""}conversations{search ? " match your search" : " yet"}.</p>
          )}
          {items?.map((i) => (
            <button
              key={i.key}
              onClick={() => open(i.key)}
              className={`w-full text-left px-4 py-3 flex gap-3 border-b border-gray-50 hover:bg-gray-50 ${activeKey === i.key ? "bg-indigo-50/60" : ""}`}
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 grid place-items-center text-sm font-semibold text-gray-600 shrink-0">{getInitials(i.name)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${i.unread ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>{i.name}</p>
                  {i.lastMessageAt && <span className="text-[11px] text-gray-400 shrink-0">{timeAgo(i.lastMessageAt)}</span>}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{i.lastMessage || "No messages yet"}</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {i.channels.map((c) => <ChannelChip key={c} c={c} />)}
                  {i.waitingForAgent && <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded text-amber-700 bg-amber-50"><Hand className="w-3 h-3" />Wants a person</span>}
                  {!!i.unread && <span className="ml-auto text-[10.5px] font-bold text-white bg-green-600 rounded-full px-1.5">{i.unread}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Thread */}
      <section className={`${activeKey ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
        {!activeKey ? (
          <div className="flex-1 grid place-items-center text-sm text-gray-500 p-8 text-center">
            <div>
              <div className="flex justify-center gap-2 mb-3"><ChannelChip c="WEB" /><ChannelChip c="WHATSAPP" /></div>
              Website chats and WhatsApp messages from the same customer appear together here.
            </div>
          </div>
        ) : threadLoading || !thread ? (
          <div className="p-6 space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64" /></div>
        ) : (
          <>
            <header className="px-4 py-3 border-b flex items-center gap-3">
              <button className="md:hidden p-1 -ml-1" onClick={() => setActiveKey(null)} aria-label="Back to list"><ArrowLeft className="w-5 h-5" /></button>
              <div className="w-9 h-9 rounded-full bg-gray-100 grid place-items-center text-sm font-semibold text-gray-600">{getInitials(thread.name)}</div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">{thread.name}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                  {thread.phone && <a href={`tel:${thread.phone}`} className="flex items-center gap-1 hover:text-indigo-600"><Phone className="w-3 h-3" />{thread.phone}</a>}
                  {thread.source && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{thread.source}</span>}
                  {thread.web?.assignedTo && <span>Assigned to {thread.web.assignedTo}</span>}
                </div>
              </div>
              {thread.web && <Link href="/dashboard/chat" className="text-xs text-indigo-600 hover:underline shrink-0">Open in Live Chat</Link>}
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-[#F7F6F2]">
              {thread.messages.map((m, idx) => {
                const prev = thread.messages[idx - 1];
                const switched = prev && prev.channel !== m.channel;
                const mine = m.from !== "customer";
                return (
                  <div key={m.id}>
                    {switched && (
                      <div className="flex items-center gap-2 my-3 text-[11px] text-gray-400">
                        <span className="flex-1 h-px bg-gray-200" />continued on {CHANNEL[m.channel].label}<span className="flex-1 h-px bg-gray-200" />
                      </div>
                    )}
                    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                        m.from === "customer" ? "bg-white ring-1 ring-black/5 text-gray-900 rounded-bl-md"
                        : m.from === "bot" ? "bg-gray-200/70 text-gray-800 rounded-br-md"
                        : m.from === "system" ? "bg-amber-50 text-amber-900"
                        : m.channel === "WHATSAPP" ? "bg-green-600 text-white rounded-br-md" : "bg-indigo-600 text-white rounded-br-md"
                      }`}>
                        {m.from === "bot" && <span className="flex items-center gap-1 text-[10.5px] font-semibold text-gray-500 mb-0.5"><Bot className="w-3 h-3" />Bot</span>}
                        {m.from === "team" && m.senderName && <span className="block text-[10.5px] font-semibold opacity-80 mb-0.5">{m.senderName}</span>}
                        {m.mediaId && m.messageType && m.messageType !== "TEXT" ? (
                          <a href={`/api/whatsapp/media/${m.mediaId}`} target="_blank" rel="noreferrer" className="underline">📎 {m.content}</a>
                        ) : m.content}
                        <span className={`block text-[10px] mt-1 ${mine && m.from === "team" ? "text-white/70" : "text-gray-400"}`}>
                          {CHANNEL[m.channel].label} · {new Date(m.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <footer className="border-t p-3 space-y-2">
              {available.length > 1 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">Reply on</span>
                  {available.map((c) => (
                    <button key={c} onClick={() => setChosenChannel(c)} className={`rounded-full px-2.5 py-1 font-medium ${channel === c ? CHANNEL[c].cls + " ring-1 ring-current" : "text-gray-500 hover:bg-gray-100"}`}>
                      {CHANNEL[c].label}
                    </button>
                  ))}
                </div>
              )}
              {waClosed ? (
                <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 flex items-start gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>
                    This customer last messaged on WhatsApp more than 24 hours ago, so WhatsApp only allows an approved template.{" "}
                    <Link href="/dashboard/whatsapp" className="underline font-medium">Send a template</Link>
                    {thread.web ? " or reply on the website chat." : "."}
                  </span>
                </p>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
                  <textarea
                    id="inbox-reply"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    rows={1}
                    placeholder={channel ? `Reply on ${CHANNEL[channel].label}…` : "Reply…"}
                    aria-label="Reply"
                    className="flex-1 resize-none max-h-32 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <Button type="submit" disabled={sending || !text.trim() || !channel} className={channel === "WHATSAPP" ? "bg-green-600 hover:bg-green-700" : "bg-indigo-600 hover:bg-indigo-700"}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </form>
              )}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
