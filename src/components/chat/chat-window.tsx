"use client";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/store/chat-store";
import { Socket } from "socket.io-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send, Paperclip, Mic, MoreVertical, UserPlus, Tag,
  StickyNote, Info, CheckCheck, Check, Phone, Mail,
  Smile, X,
} from "lucide-react";
import { cn, timeAgo, getInitials, formatDate } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  suggestedReplies?: string[];
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
  onSend: (content: string, type?: string, isNote?: boolean, attachments?: { name: string; url: string; type: string; size: number }[]) => void;
  onTyping: (isTyping: boolean) => void;
  onToggleDetails: () => void;
  showDetails: boolean;
  socket: Socket | null;
}

export function ChatWindow({ conversationId, onSend, onTyping, onToggleDetails, showDetails, socket }: Props) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { messages: storeMessages, typingUsers } = useChatStore();
  const [input, setInput] = useState("");
  const [isNote, setIsNote] = useState(false);
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
  });

  const messages = storeMessages[conversationId] || messagesData || [];
  const isTyping = typingUsers.some(
    (t) => t.conversationId === conversationId && t.userId !== session?.user?.id
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    onTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => onTyping(false), 1000);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim(), "TEXT", isNote);
    setInput("");
    setIsNote(false);
    onTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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
            <div className="flex items-center gap-2">
              {conv?.visitor?.currentPage && (
                <p className="text-xs text-gray-400 truncate max-w-[200px]">on {conv.visitor.currentPage}</p>
              )}
              <Badge variant="outline" className="text-[10px] px-1 py-0">{conv?.status}</Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
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
              <DropdownMenuItem onClick={resolveConversation}>Mark as Resolved</DropdownMenuItem>
              <DropdownMenuItem>Transfer Chat</DropdownMenuItem>
              <DropdownMenuItem>Add Tag</DropdownMenuItem>
              <DropdownMenuItem>Create Ticket</DropdownMenuItem>
              <DropdownMenuItem>Create Lead</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => {
          const isAgent = msg.senderType === "AGENT" || msg.senderType === "BOT";
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

          return (
            <div key={msg._id} className={cn("flex gap-3", isAgent ? "flex-row-reverse" : "")}>
              {!isAgent && (
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                    {getInitials(conv?.visitor?.name || "V")}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={cn("max-w-[70%] space-y-1", isAgent && "items-end")}>
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
                          <Paperclip className="w-3 h-3" />
                          {att.name}
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

      <div className={cn("border-t bg-white p-3 shrink-0", isNote && "bg-yellow-50 border-yellow-200")}>
        {isNote && (
          <div className="flex items-center gap-1.5 mb-2 text-xs text-yellow-700">
            <StickyNote className="w-3.5 h-3.5" />
            <span>Writing internal note (not visible to visitor)</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={isNote ? "Write an internal note..." : "Type a message... (Enter to send)"}
              rows={1}
              className={cn(
                "w-full resize-none rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 max-h-32",
                isNote ? "border-yellow-300 bg-yellow-50" : "border-gray-200 bg-gray-50"
              )}
              style={{ minHeight: "40px" }}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9", isNote && "text-yellow-600 bg-yellow-100")}
              onClick={() => setIsNote(!isNote)}
              title="Internal Note"
            >
              <StickyNote className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleSend}
              disabled={!input.trim()}
              className="h-9 w-9 bg-indigo-500 hover:bg-indigo-600"
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
