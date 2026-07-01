"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/store/chat-store";
import { Socket } from "socket.io-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Send, Paperclip, MoreVertical,
  StickyNote, Info, CheckCheck, Check,
  Smile, X, Zap, Download, Tag, Search,
  ArrowLeft, UserRoundCog, Reply,
} from "lucide-react";
import { cn, timeAgo, getInitials } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface Message {
  _id: string;
  conversationId: string;
  content: string;
  senderType: "AGENT" | "VISITOR" | "BOT" | "SYSTEM";
  senderId?: { _id: string; name: string; avatar?: string };
  type: string;
  isNote: boolean;
  isRead: boolean;
  isDelivered: boolean;
  createdAt: string;
  attachments?: { name: string; url: string; type: string; size: number }[];
  replyTo?: { _id: string; content: string; senderType: string };
}

interface Conversation {
  _id: string;
  status: string;
  visitor: { name?: string; email?: string; phone?: string; visitorId: string; currentPage?: string };
  assignedTo?: { _id: string; name: string; avatar?: string };
  priority: string;
  tags: string[];
  createdAt: string;
}

interface Props {
  conversationId: string;
  onSend: (content: string, type?: string, isNote?: boolean, attachments?: { name: string; url: string; type: string; size: number }[], replyToId?: string) => void;
  onTyping: (isTyping: boolean) => void;
  onToggleDetails: () => void;
  showDetails: boolean;
  socket: Socket | null;
  viewers?: { userId: string; name: string }[];
}

const EMOJIS = [
  "😊","😂","🙏","👍","❤️","🎉","✅","⚡",
  "😅","🤔","👋","💪","🔥","⭐","💙","🙌",
  "😮","🥳","😎","🤝","👀","✨","💡","📞",
  "🛠️","📋","🚀","⏰","📱","💬","🔍","📍",
];

const BUILT_IN_REPLIES = [
  { category: "Greeting", messages: [
    "Hi! How may I help you today? 😊",
    "Hello! Welcome to our support. How can I assist you?",
    "Good day! What can I do for you?",
  ]},
  { category: "Wait", messages: [
    "Please hold on, let me check that for you. 🔍",
    "Give me just a moment, I'll look into this right away.",
    "I'm checking on this for you, please wait a moment.",
  ]},
  { category: "Details", messages: [
    "Could you please share more details about your issue?",
    "Can you tell me your order ID / booking number?",
    "Could you please share your email address so I can look that up?",
  ]},
  { category: "Resolution", messages: [
    "I've noted your concern and will get back to you shortly.",
    "Your issue has been escalated to our team. You'll hear from us soon.",
    "I've resolved this on our end. Please try again and let me know!",
  ]},
  { category: "Closing", messages: [
    "Is there anything else I can help you with? 😊",
    "Thank you for contacting us! Have a great day! 👋",
    "Feel free to reach out anytime. We're always here to help!",
  ]},
];

export function ChatWindow({ conversationId, onSend, onTyping, onToggleDetails, showDetails, socket, viewers = [] }: Props) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages: storeMessages, typingUsers } = useChatStore();

  const [input, setInput] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferAgentId, setTransferAgentId] = useState("");
  const [transferNote, setTransferNote] = useState("");

  const { data: conv } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/conversations/${conversationId}`);
      const d = await res.json();
      return d.data as Conversation;
    },
  });

  const { data: messagesData } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages?limit=100`);
      const d = await res.json();
      return d.data?.messages as Message[];
    },
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  // Agents for transfer modal
  const { data: agents } = useQuery({
    queryKey: ["agents", "all"],
    queryFn: async () => {
      const res = await fetch("/api/agents?limit=50");
      const d = await res.json();
      return d.data as { _id: string; name: string; isOnline: boolean }[];
    },
    staleTime: 60_000,
  });

  // Fetch canned responses from DB
  const { data: cannedResponses } = useQuery({
    queryKey: ["canned-responses"],
    queryFn: async () => {
      const res = await fetch("/api/canned-responses");
      const d = await res.json();
      return d.data as { _id: string; title: string; shortcut: string; content: string; category: string }[];
    },
    staleTime: 60_000,
  });

  const baseMessages = messagesData || [];
  const storeAdditions = (storeMessages[conversationId] || []).filter(
    (m) => !baseMessages.some((bm) => bm._id === m._id)
  );
  const messages = [...baseMessages, ...storeAdditions] as Message[];
  const isTyping = typingUsers.some(
    (t) => t.conversationId === conversationId && t.userId !== session?.user?.id
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Merge built-in + DB canned responses into one flat list
  const allQuickReplies: { category: string; content: string; shortcut?: string }[] = [
    ...BUILT_IN_REPLIES.flatMap((g) => g.messages.map((m) => ({ category: g.category, content: m }))),
    ...(cannedResponses || []).map((r) => ({ category: r.category, content: r.content, shortcut: r.shortcut })),
  ];

  const filteredReplies = quickSearch.trim()
    ? allQuickReplies.filter((r) =>
        r.content.toLowerCase().includes(quickSearch.toLowerCase()) ||
        r.category.toLowerCase().includes(quickSearch.toLowerCase()) ||
        (r.shortcut && r.shortcut.includes(quickSearch.toLowerCase()))
      )
    : allQuickReplies;

  // Group filtered replies by category
  const groupedReplies = filteredReplies.reduce<Record<string, typeof filteredReplies>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    onTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => onTyping(false), 1000);

    // "/" triggers quick replies search
    if (val === "/") {
      setShowQuickReplies(true);
      setQuickSearch("");
    } else if (val.startsWith("/") && showQuickReplies) {
      setQuickSearch(val.slice(1));
    } else if (!val.startsWith("/")) {
      setQuickSearch("");
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const body: Parameters<typeof onSend> = [input.trim(), "TEXT", isNote, undefined, replyTo?._id];
    onSend(...body);
    setInput("");
    setIsNote(false);
    setReplyTo(null);
    setShowQuickReplies(false);
    setShowEmoji(false);
    setQuickSearch("");
    onTyping(false);
  };

  const handleTransfer = async () => {
    if (!transferAgentId) return;
    const res = await fetch(`/api/chat/conversations/${conversationId}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: transferAgentId, note: transferNote }),
    });
    const data = await res.json();
    if (data.success) {
      toast({ title: "Chat transferred successfully" });
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    } else {
      toast({ title: "Transfer failed", variant: "destructive" });
    }
    setShowTransfer(false);
    setTransferAgentId("");
    setTransferNote("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      setShowQuickReplies(false);
      setShowEmoji(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmoji(false);
  };

  const pickQuickReply = (content: string) => {
    setInput(content);
    setShowQuickReplies(false);
    setQuickSearch("");
  };

  const downloadTranscript = () => {
    const visitorName = conv?.visitor?.name || conv?.visitor?.email || "Visitor";
    const lines = [
      `Conversation Transcript`,
      `Visitor: ${visitorName}`,
      `Date: ${conv ? new Date(conv.createdAt).toLocaleString() : ""}`,
      `---`,
      ...messages.map((m) => {
        const time = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const who = m.senderType === "AGENT" ? "Agent" : m.senderType === "VISITOR" ? visitorName : m.senderType;
        return `[${time}] ${who}: ${m.content}`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${conversationId.slice(-6)}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resolveConversation = async () => {
    await fetch(`/api/chat/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED", resolvedAt: new Date() }),
    });
    qc.invalidateQueries({ queryKey: ["conversations"] });
    qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
  };

  const addTag = async () => {
    const tag = tagInput.trim().toUpperCase().replace(/\s+/g, "_");
    if (!tag) return;
    const current = conv?.tags || [];
    if (current.includes(tag)) { setTagInput(""); setShowTagInput(false); return; }
    await fetch(`/api/chat/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: [...current, tag] }),
    });
    qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
    setTagInput("");
    setShowTagInput(false);
  };

  const removeTag = async (tag: string) => {
    const current = conv?.tags || [];
    await fetch(`/api/chat/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: current.filter((t) => t !== tag) }),
    });
    qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast({ title: "File too large (max 10 MB)", variant: "destructive" }); return; }
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.success && data.data?.url) {
      onSend(file.name, "FILE", false, [{ name: file.name, url: data.data.url, type: file.type, size: file.size }]);
    } else {
      toast({ title: "Upload failed", description: data.error || "File could not be uploaded.", variant: "destructive" });
    }
    e.target.value = "";
  };

  const priorityColors: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-600",
    NORMAL: "bg-blue-100 text-blue-600",
    HIGH: "bg-orange-100 text-orange-600",
    URGENT: "bg-red-100 text-red-600",
  };

  return (
    <>
    {/* Transfer dialog */}
    <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCog className="w-4 h-4" /> Transfer Chat
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Transfer to Agent</label>
            <Select value={transferAgentId} onValueChange={setTransferAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents?.map((a) => (
                  <SelectItem key={a._id} value={a._id}>
                    <span className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", a.isOnline ? "bg-green-500" : "bg-gray-300")} />
                      {a.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Note (optional)</label>
            <Input
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="Reason for transfer..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowTransfer(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={!transferAgentId} className="bg-indigo-600 hover:bg-indigo-700">
              Transfer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <div className="flex-1 flex flex-col overflow-hidden" onClick={() => { setShowEmoji(false); }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9">
            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm font-medium">
              {getInitials(conv?.visitor?.name || conv?.visitor?.email || "V")}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm text-gray-900">
              {conv?.visitor?.name || conv?.visitor?.email || "Anonymous Visitor"}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {conv?.visitor?.currentPage && (
                <p className="text-xs text-gray-400 truncate max-w-45">on {conv.visitor.currentPage}</p>
              )}
              <Badge variant="outline" className="text-[10px] px-1 py-0">{conv?.status}</Badge>
              {conv?.priority && conv.priority !== "NORMAL" && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", priorityColors[conv.priority])}>
                  {conv.priority}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-1 flex-wrap mx-2">
          {conv?.tags?.map((tag) => (
            <span key={tag} className="group flex items-center gap-0.5 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full font-medium">
              {tag.replace(/_/g, " ")}
              <button onClick={() => removeTag(tag)} className="opacity-0 group-hover:opacity-100 ml-0.5">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          {showTagInput ? (
            <form onSubmit={(e) => { e.preventDefault(); addTag(); }} className="flex items-center gap-1">
              <Input
                autoFocus
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="tag name"
                className="h-6 text-xs w-24 px-1.5"
                onKeyDown={(e) => e.key === "Escape" && setShowTagInput(false)}
              />
              <button type="submit" className="text-indigo-600"><Check className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => setShowTagInput(false)}><X className="w-3.5 h-3.5 text-gray-400" /></button>
            </form>
          ) : (
            <button onClick={() => setShowTagInput(true)} className="text-[10px] text-gray-400 hover:text-indigo-500 flex items-center gap-0.5 border border-dashed border-gray-300 rounded-full px-1.5 py-0.5">
              <Tag className="w-2.5 h-2.5" /> tag
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleDetails}>
            <Info className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={resolveConversation}>✅ Mark as Resolved</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowTransfer(true)}><UserRoundCog className="w-3.5 h-3.5 mr-2" />Transfer Chat</DropdownMenuItem>
              <DropdownMenuItem onClick={downloadTranscript}><Download className="w-3.5 h-3.5 mr-2" />Download Transcript</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowTagInput(true)}><Tag className="w-3.5 h-3.5 mr-2" />Add Tag</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Collision banner — shown when another agent is viewing ── */}
      {viewers.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          {viewers.length === 1
            ? `${viewers[0].name} is also viewing this conversation`
            : `${viewers.map((v) => v.name).join(", ")} are also viewing this conversation`}
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => {
          const isAgent = msg.senderType === "AGENT";
          const isBot   = msg.senderType === "BOT";
          const isSystem = msg.senderType === "SYSTEM";

          if (isSystem) {
            return (
              <div key={msg._id} className="text-center">
                <span className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded-full">{msg.content}</span>
              </div>
            );
          }

          if (msg.isNote) {
            return (
              <div key={msg._id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mx-4">
                <div className="flex items-center gap-2 mb-1">
                  <StickyNote className="w-3.5 h-3.5 text-yellow-600" />
                  <span className="text-xs font-medium text-yellow-700">Internal Note</span>
                  <span className="text-xs text-gray-400 ml-auto">{timeAgo(msg.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700">{msg.content}</p>
              </div>
            );
          }

          if (isBot) {
            return (
              <div key={msg._id} className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-xs">🤖</div>
                <div className="max-w-[72%] bg-indigo-50 border border-indigo-100 text-indigo-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm">
                  {msg.content}
                  <div className="text-[10px] text-indigo-400 mt-1">{timeAgo(msg.createdAt)}</div>
                </div>
              </div>
            );
          }

          return (
            <div key={msg._id} className={cn("group flex gap-3 relative", isAgent ? "flex-row-reverse" : "")}>
              {!isAgent && (
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                    {getInitials(conv?.visitor?.name || "V")}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={cn("max-w-[70%] space-y-1", isAgent && "items-end")}>
                {/* Quoted reply preview */}
                {msg.replyTo && (
                  <div className={cn(
                    "text-xs px-3 py-1.5 rounded-lg border-l-2 mb-1 opacity-70",
                    isAgent ? "bg-indigo-400/20 border-indigo-300 text-indigo-100" : "bg-gray-100 border-gray-400 text-gray-500"
                  )}>
                    <span className="font-medium">{msg.replyTo.senderType === "AGENT" ? "Agent" : "Visitor"}: </span>
                    <span className="line-clamp-1">{msg.replyTo.content}</span>
                  </div>
                )}
                <div className={cn(
                  "px-4 py-2.5 rounded-2xl text-sm",
                  isAgent
                    ? "bg-indigo-500 text-white rounded-tr-sm"
                    : "bg-white text-gray-900 border border-gray-100 rounded-tl-sm shadow-sm"
                )}>
                  {msg.attachments?.map((att, i) => (
                    <div key={i} className="mb-2">
                      {att.type.startsWith("image/") ? (
                        <img src={att.url} alt={att.name} className="max-w-full rounded-lg" />
                      ) : (
                        <a href={att.url} download className="flex items-center gap-2 text-xs underline">
                          <Paperclip className="w-3 h-3" />{att.name}
                        </a>
                      )}
                    </div>
                  ))}
                  {msg.content}
                </div>
                <div className={cn("flex items-center gap-1 text-xs text-gray-400", isAgent && "flex-row-reverse")}>
                  <span>{timeAgo(msg.createdAt)}</span>
                  {isAgent && (
                    msg.isRead
                      ? <CheckCheck className="w-3 h-3 text-blue-500" />
                      : msg.isDelivered
                        ? <CheckCheck className="w-3 h-3" />
                        : <Check className="w-3 h-3" />
                  )}
                </div>
              </div>
              {/* Reply button — visible on hover */}
              <button
                onClick={() => setReplyTo(msg)}
                className={cn(
                  "opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0 p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50",
                  isAgent ? "mr-1" : "ml-1"
                )}
                title="Reply"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex gap-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-gray-200 text-xs">V</AvatarFallback>
            </Avatar>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div className={cn("border-t bg-white shrink-0", isNote && "bg-yellow-50 border-yellow-200")} onClick={(e) => e.stopPropagation()}>

        {/* Quick Replies Panel */}
        {showQuickReplies && (
          <div className="border-b bg-gray-50 max-h-60 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-3 py-2 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                autoFocus
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Search replies… or type after /"
                className="flex-1 text-xs outline-none bg-transparent placeholder-gray-400"
              />
              <button onClick={() => { setShowQuickReplies(false); setQuickSearch(""); setInput(""); }}>
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            {Object.entries(groupedReplies).map(([cat, replies]) => (
              <div key={cat} className="px-3 py-1.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{cat}</p>
                {replies.map((r) => (
                  <button
                    key={r.content}
                    onClick={() => pickQuickReply(r.content)}
                    className="w-full text-left text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5 mb-1 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 transition-colors flex items-start gap-2"
                  >
                    {r.shortcut && <span className="text-indigo-400 shrink-0">/{r.shortcut}</span>}
                    <span className="line-clamp-1">{r.content}</span>
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(groupedReplies).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No replies match "{quickSearch}"</p>
            )}
          </div>
        )}

        {/* Emoji picker */}
        {showEmoji && (
          <div className="border-b bg-white px-3 py-2">
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => insertEmoji(e)}
                  className="text-xl hover:scale-125 transition-transform p-0.5 rounded">{e}</button>
              ))}
            </div>
          </div>
        )}

        {/* Reply-to preview bar */}
        {replyTo && (
          <div className="flex items-center gap-2 px-3 pt-2 pb-0">
            <div className="flex-1 flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 text-xs">
              <ArrowLeft className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0 rotate-180" />
              <div className="min-w-0">
                <span className="font-semibold text-indigo-700">{replyTo.senderType === "AGENT" ? "Agent" : "Visitor"}: </span>
                <span className="text-gray-600 line-clamp-1">{replyTo.content}</span>
              </div>
            </div>
            <button onClick={() => setReplyTo(null)} className="shrink-0 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="p-3">
          {isNote && (
            <div className="flex items-center gap-1.5 mb-2 text-xs text-yellow-700">
              <StickyNote className="w-3.5 h-3.5" />
              <span>Writing internal note — not visible to visitor</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={isNote ? "Write an internal note..." : "Type / for quick replies or a message… (Enter to send)"}
                rows={1}
                className={cn(
                  "w-full resize-none rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 max-h-32",
                  isNote ? "border-yellow-300 bg-yellow-50" : "border-gray-200 bg-gray-50"
                )}
                style={{ minHeight: "40px" }}
              />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Emoji */}
              <Button variant="ghost" size="icon" className={cn("h-9 w-9", showEmoji && "text-yellow-500 bg-yellow-50")}
                onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); setShowQuickReplies(false); }}
                title="Emoji">
                <Smile className="w-4 h-4" />
              </Button>
              {/* Quick replies */}
              <Button variant="ghost" size="icon" className={cn("h-9 w-9", showQuickReplies && "text-indigo-600 bg-indigo-50")}
                onClick={() => { setShowQuickReplies(!showQuickReplies); setShowEmoji(false); setQuickSearch(""); }}
                title="Quick Replies">
                <Zap className="w-4 h-4" />
              </Button>
              {/* File attach */}
              <Button variant="ghost" size="icon" className="h-9 w-9" title="Attach file"
                onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="w-4 h-4" />
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange}
                accept="image/*,.pdf,.doc,.docx,.txt,.csv" />
              {/* Note */}
              <Button variant="ghost" size="icon" className={cn("h-9 w-9", isNote && "text-yellow-600 bg-yellow-100")}
                onClick={() => setIsNote(!isNote)} title="Internal Note">
                <StickyNote className="w-4 h-4" />
              </Button>
              {/* Send */}
              <Button onClick={handleSend} disabled={!input.trim()}
                className="h-9 w-9 bg-indigo-500 hover:bg-indigo-600" size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
