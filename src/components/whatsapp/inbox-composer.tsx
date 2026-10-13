"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  Send, Smile, Paperclip, Zap, Loader2, X, FileText, Image as ImageIcon, Music, LayoutTemplate, Search, File as FileIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { ACCEPT_AUDIO, ACCEPT_DOCUMENT, ACCEPT_PHOTO_VIDEO, checkMediaFile, mediaKindFor } from "@/lib/whatsapp-media";

const EMOJI_GROUPS: { label: string; icon: string; emojis: string[] }[] = [
  { label: "Smileys", icon: "😊", emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","😉","😌","😍","🥰","😘","😋","😛","😜","🤪","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤯","😳","😱","😨","😰","😥","🤗","🤔","🤭","🤫","😶","😐","😑","😬","🙄","😯","😴","🤤","😪","😵","🤐","🤒","🤕","🤑"] },
  { label: "Gestures", icon: "👍", emojis: ["👍","👎","👌","🤌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","👏","🙌","👐","🤲","🤝","🙏","✍️","💪","🫶","💅","🤳"] },
  { label: "Hearts", icon: "❤️", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💯","✨","⭐","🌟","💫","🔥","🎉","🎊","🎁","🏆","🥇","🎯"] },
  { label: "Business", icon: "💼", emojis: ["✅","☑️","✔️","❌","⚠️","❗","❓","ℹ️","📞","📱","💬","📧","📩","📨","📝","📋","📄","📑","📊","📈","📅","🗓️","⏰","⏳","⌛","💰","💵","💳","🧾","🏷️","🛒","🛍️","📦","🚚","🏠","🏢","📍","🗺️","🔗","🔒","🔑","💡","🔍","⚙️","🛠️","🚀","💼","🤖"] },
  { label: "Food & travel", icon: "🍕", emojis: ["☕","🍵","🥤","🍕","🍔","🍟","🌮","🍰","🎂","🍫","🍎","🍌","🥗","🍛","🍽️","🚗","🚕","🏍️","✈️","🚆","🏨","🏖️","⛰️","🌍","☀️","🌧️","❄️","🌈","🌸","🌹"] },
];

const BUILT_IN_REPLIES: { category: string; content: string; shortcut?: string }[] = [
  { category: "Greeting", content: "Hi! Thanks for messaging us. How can I help you today? 😊" },
  { category: "Greeting", content: "Hello! Welcome — what can I do for you?" },
  { category: "Wait", content: "Please give me a moment while I check that for you. 🔍" },
  { category: "Wait", content: "Thanks for your patience, I'm looking into this right now." },
  { category: "Info", content: "Could you please share your full name and the best time to reach you?" },
  { category: "Closing", content: "Is there anything else I can help you with?" },
  { category: "Closing", content: "Thank you for contacting us! Have a great day. 🙏" },
];

export interface ComposerMessage {
  _id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  messageType: "TEXT" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" | "TEMPLATE";
  content?: string;
  fileName?: string;
  localUrl?: string;
  status: string;
  createdAt: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(e: unknown) {
  if (axios.isAxiosError(e)) {
    if (e.response?.status === 413) return "This file is too large for the server to accept.";
    return e.response?.data?.error || e.message;
  }
  return "Message could not be sent";
}

export function InboxComposer({
  conversationId,
  onOpenTemplates,
}: {
  conversationId: string;
  onOpenTemplates: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [panel, setPanel] = useState<"emoji" | "replies" | null>(null);
  const [emojiGroup, setEmojiGroup] = useState(0);
  const [replySearch, setReplySearch] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  // A ref, not state: it flips synchronously, so a fast double-click or
  // Enter+click can't start a second send before React re-renders.
  const sendingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);


  // Grow the textarea with its content, up to ~6 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const previewUrl = useMemo(() => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const { data: canned } = useQuery({
    queryKey: ["canned-responses"],
    queryFn: () => axios.get("/api/canned-responses").then((r) => r.data.data as { content: string; category: string; shortcut?: string }[]),
    staleTime: 60_000,
    enabled: panel === "replies",
  });

  const replies = useMemo(() => {
    const all = [...(canned || []).map((r) => ({ category: r.category || "Saved", content: r.content, shortcut: r.shortcut })), ...BUILT_IN_REPLIES];
    const q = replySearch.trim().toLowerCase();
    const list = q ? all.filter((r) => r.content.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || r.shortcut?.toLowerCase().includes(q)) : all;
    return list.reduce<Record<string, typeof list>>((acc, r) => ((acc[r.category] ||= []).push(r), acc), {});
  }, [canned, replySearch]);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    const problem = checkMediaFile(f);
    if (problem) {
      toast({ title: "Can't attach this file", description: problem, variant: "destructive" });
      return;
    }
    setFile(f);
    setPanel(null);
    textareaRef.current?.focus();
  };

  const insertAtCursor = (value: string) => {
    const el = textareaRef.current;
    if (!el) return setText((t) => t + value);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + value + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + value.length, start + value.length);
    });
  };

  const send = async () => {
    const body = text.trim();
    if (sendingRef.current || (!body && !file)) return;
    sendingRef.current = true;
    setSending(true);

    const clientMessageId = newClientId();
    const key = ["whatsapp-messages", conversationId];
    const sentText = text;
    const sentFile = file;
    const kind = sentFile ? mediaKindFor(sentFile.type) : null;

    // Show the message straight away with a clock icon; the real one replaces
    // it when the list refreshes.
    const optimistic: ComposerMessage = {
      _id: `pending-${clientMessageId}`,
      conversationId,
      direction: "OUTBOUND",
      messageType: kind ? (kind.toUpperCase() as ComposerMessage["messageType"]) : "TEXT",
      content: body || undefined,
      fileName: kind === "document" ? sentFile?.name : undefined,
      localUrl: sentFile && kind !== "document" ? URL.createObjectURL(sentFile) : undefined,
      status: "SENDING",
      createdAt: new Date().toISOString(),
    };
    qc.setQueryData<ComposerMessage[]>(key, (old) => [...(old || []), optimistic]);
    setText("");
    setFile(null);
    setPanel(null);

    try {
      if (sentFile) {
        const form = new FormData();
        form.append("file", sentFile);
        if (body) form.append("caption", body);
        form.append("clientMessageId", clientMessageId);
        setProgress(0);
        await axios.post(`/api/whatsapp/conversations/${conversationId}/messages`, form, {
          onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
        });
      } else {
        await axios.post(`/api/whatsapp/conversations/${conversationId}/messages`, { content: body, clientMessageId });
      }
    } catch (e) {
      qc.setQueryData<ComposerMessage[]>(key, (old) => (old || []).filter((m) => m._id !== optimistic._id));
      // Give the draft back so nothing typed is lost.
      setText(sentText);
      setFile(sentFile);
      toast({ title: "Message not sent", description: errorMessage(e), variant: "destructive" });
    } finally {
      if (optimistic.localUrl) setTimeout(() => URL.revokeObjectURL(optimistic.localUrl!), 30_000);
      sendingRef.current = false;
      setSending(false);
      setProgress(null);
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      textareaRef.current?.focus();
    }
  };

  const fileKind = file ? mediaKindFor(file.type) : null;
  const canSend = !sending && (!!text.trim() || !!file);

  return (
    <div
      className="border-t bg-white"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}
    >
      {panel === "emoji" && (
        <div className="border-b px-3 pt-2 pb-3">
          <div className="flex gap-1 mb-2">
            {EMOJI_GROUPS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                title={g.label}
                onClick={() => setEmojiGroup(i)}
                className={cn("text-lg px-2 py-1 rounded-md", i === emojiGroup ? "bg-green-50 ring-1 ring-green-200" : "hover:bg-gray-100")}
              >
                {g.icon}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-10 sm:grid-cols-12 gap-0.5 max-h-44 overflow-y-auto">
            {EMOJI_GROUPS[emojiGroup].emojis.map((e) => (
              <button key={e} type="button" onClick={() => insertAtCursor(e)} className="text-xl p-1 rounded hover:bg-gray-100 transition-transform hover:scale-110">
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {panel === "replies" && (
        <div className="border-b max-h-60 overflow-y-auto bg-gray-50">
          <div className="sticky top-0 bg-white border-b px-3 py-2 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              autoFocus
              value={replySearch}
              onChange={(e) => setReplySearch(e.target.value)}
              placeholder="Search quick replies…"
              className="flex-1 text-xs outline-none bg-transparent"
            />
            <button type="button" onClick={() => setPanel(null)}><X className="w-3.5 h-3.5 text-gray-400" /></button>
          </div>
          {Object.entries(replies).map(([cat, list]) => (
            <div key={cat} className="px-3 py-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{cat}</p>
              {list.map((r) => (
                <button
                  key={r.content}
                  type="button"
                  onClick={() => { setText(r.content); setPanel(null); textareaRef.current?.focus(); }}
                  className="w-full text-left text-xs bg-white border rounded-lg px-3 py-1.5 mb-1 hover:border-green-400 hover:bg-green-50 flex gap-2"
                >
                  {r.shortcut && <span className="text-green-600 shrink-0">/{r.shortcut}</span>}
                  <span className="line-clamp-1">{r.content}</span>
                </button>
              ))}
            </div>
          ))}
          {Object.keys(replies).length === 0 && <p className="text-xs text-gray-400 text-center py-4">No replies match</p>}
        </div>
      )}

      {file && (
        <div className="px-3 pt-3">
          <div className="flex items-center gap-3 rounded-xl border bg-gray-50 p-2">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-white border flex items-center justify-center text-green-600">
                {fileKind === "video" ? <ImageIcon className="w-6 h-6" /> : fileKind === "audio" ? <Music className="w-6 h-6" /> : <FileIcon className="w-6 h-6" />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-gray-500">
                {formatSize(file.size)}
                {fileKind === "audio" ? " · audio can't have a caption" : " · add a caption below (optional)"}
              </p>
            </div>
            <button type="button" onClick={() => setFile(null)} disabled={sending} className="p-1 text-gray-400 hover:text-gray-700" title="Remove">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="p-3 flex items-end gap-1.5">
        <Button type="button" variant="ghost" size="icon" title="Emoji"
          className={cn("shrink-0 h-10 w-10", panel === "emoji" && "bg-yellow-50 text-yellow-600")}
          onClick={() => setPanel(panel === "emoji" ? null : "emoji")}>
          <Smile className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="Attach" className="shrink-0 h-10 w-10" disabled={sending}>
              <Paperclip className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-52">
            <DropdownMenuItem onSelect={() => docInput.current?.click()}>
              <FileText className="w-4 h-4 mr-2 text-indigo-600" /> Document
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => photoInput.current?.click()}>
              <ImageIcon className="w-4 h-4 mr-2 text-blue-600" /> Photos &amp; videos
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => audioInput.current?.click()}>
              <Music className="w-4 h-4 mr-2 text-orange-500" /> Audio
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPanel("replies")}>
              <Zap className="w-4 h-4 mr-2 text-green-600" /> Quick replies
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenTemplates}>
              <LayoutTemplate className="w-4 h-4 mr-2 text-purple-600" /> Template
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input ref={docInput} type="file" hidden accept={ACCEPT_DOCUMENT} onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={photoInput} type="file" hidden accept={ACCEPT_PHOTO_VIDEO} onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={audioInput} type="file" hidden accept={ACCEPT_AUDIO} onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          disabled={fileKind === "audio"}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value === "/") { setPanel("replies"); setReplySearch(""); }
            else if (panel === "replies" && e.target.value.startsWith("/")) setReplySearch(e.target.value.slice(1));
          }}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter adds a new line (like WhatsApp Web).
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          onPaste={(e) => {
            const pasted = Array.from(e.clipboardData.files)[0];
            if (pasted) { e.preventDefault(); pickFile(pasted); }
          }}
          placeholder={file ? (fileKind === "audio" ? "Audio is sent without a caption" : "Add a caption…") : "Type a message  ·  / for quick replies  ·  Shift+Enter for new line"}
          className="flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-60"
        />

        <Button
          type="button"
          onClick={send}
          disabled={!canSend}
          className="shrink-0 h-10 w-10 rounded-full bg-green-600 hover:bg-green-700 p-0"
          title={sending ? "Sending…" : "Send"}
        >
          {sending ? (
            progress !== null && progress < 100 ? <span className="text-[10px] font-semibold">{progress}%</span> : <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="px-4 pb-2 -mt-1 text-[11px] text-gray-400">
        Free-text, files and emoji work within 24h of the customer&apos;s last message; after that, send a template.
      </p>
    </div>
  );
}
