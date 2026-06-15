"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "@/store/chat-store";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { ConversationDetails } from "./conversation-details";
import { cn } from "@/lib/utils";
import { X, Bell, MessageSquare, Tag } from "lucide-react";
import {
  playMessage,
  playNewConversation,
  playLeadCreated,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from "@/lib/notification-sound";

let socket: Socket | null = null;

interface LiveNotification {
  id: string;
  type: "conversation" | "message" | "lead" | "ticket" | "agent_request";
  title: string;
  body: string;
  conversationId?: string;
}

export function LiveChat() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [showDetails, setShowDetails] = useState(true);
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const notifTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const {
    activeConversationId,
    setActiveConversation,
    addMessage,
    updateConversation,
    setTyping,
  } = useChatStore();

  // Keep a ref so socket handlers always see the latest active conversation
  const activeConvRef = useRef(activeConversationId);
  useEffect(() => {
    activeConvRef.current = activeConversationId;
  }, [activeConversationId]);

  const pushNotification = useCallback((notif: Omit<LiveNotification, "id">) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotifications((prev) => [{ ...notif, id }, ...prev].slice(0, 3));
    const timer = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      notifTimers.current.delete(id);
    }, 6000);
    notifTimers.current.set(id, timer);
  }, []);

  const dismiss = useCallback((id: string) => {
    clearTimeout(notifTimers.current.get(id));
    notifTimers.current.delete(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Request browser notification permission once
  useEffect(() => {
    requestBrowserNotificationPermission();
  }, []);

  useEffect(() => {
    if (!session?.user || socket) return;

    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "", {
      auth: { token: session.user.id },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket?.emit("agent:status", { status: "online" });
    });

    socket.on("connect_error", (err) => {
      console.warn("Socket connection error:", err.message);
    });

    socket.on("message:new", (message) => {
      // Skip agent messages coming from socket — REST send already added them optimistically
      if (message.senderType === "AGENT") return;
      addMessage(message);
      updateConversation(message.conversationId, { lastMessageAt: message.createdAt });
      qc.invalidateQueries({ queryKey: ["conversations"] });

      if (message.senderType === "VISITOR" && message.conversationId !== activeConvRef.current) {
        playMessage();
        const name = message.visitorName || "Visitor";
        pushNotification({
          type: "message",
          title: `Message from ${name}`,
          body: (message.content || "").slice(0, 90),
          conversationId: message.conversationId,
        });
        showBrowserNotification(`Message from ${name}`, (message.content || "").slice(0, 100));
      }
    });

    socket.on("conversation:new", (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      playNewConversation();
      const name = data.visitor?.name || data.visitor?.email || "New visitor";
      pushNotification({
        type: "conversation",
        title: "New conversation",
        body: `${name} started a chat`,
        conversationId: data.conversationId,
      });
      showBrowserNotification("New visitor!", `${name} started a chat`);
    });

    socket.on("notification:new", (data: { type: string; conversationId?: string; message: string; name?: string }) => {
      if (data.type === "lead") {
        playLeadCreated();
        pushNotification({
          type: "lead",
          title: "New lead captured!",
          body: data.message || `Lead from ${data.name || "Visitor"}`,
          conversationId: data.conversationId,
        });
        showBrowserNotification("New Lead", data.message || "A visitor submitted their details");
      } else if (data.type === "ticket") {
        playLeadCreated();
        pushNotification({
          type: "ticket",
          title: "New service ticket",
          body: data.message || "Visitor requested service",
          conversationId: data.conversationId,
        });
        showBrowserNotification("New Service Ticket", data.message || "");
      } else if (data.type === "agent_request") {
        playNewConversation();
        pushNotification({
          type: "agent_request",
          title: "Agent requested!",
          body: data.message || "A visitor needs a live agent",
          conversationId: data.conversationId,
        });
        showBrowserNotification("Agent Requested", data.message || "A visitor needs to speak with an agent");
      }
    });

    socket.on("conversation:updated", (data) => {
      updateConversation(data.conversationId, { lastMessageAt: data.lastMessageAt });
    });

    socket.on("conversation:assigned", (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      playMessage();
      pushNotification({
        type: "conversation",
        title: "Conversation assigned to you",
        body: "A conversation has been assigned",
        conversationId: data.conversationId,
      });
    });

    socket.on("typing:start", (data) => {
      setTyping(data.userId, data.conversationId, true);
    });

    socket.on("typing:stop", (data) => {
      setTyping(data.userId, data.conversationId, false);
    });

    socket.on("message:read", (data) => {
      qc.invalidateQueries({ queryKey: ["messages", data.conversationId] });
    });

    return () => {
      socket?.emit("agent:status", { status: "offline" });
      socket?.disconnect();
      socket = null;
    };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectConversation = (id: string) => {
    if (activeConversationId) socket?.emit("leave:conversation", activeConversationId);
    setActiveConversation(id);
    socket?.emit("join:conversation", id);
  };

  const handleSendMessage = async (
    content: string,
    type: string = "TEXT",
    isNote: boolean = false,
    attachments?: { name: string; url: string; type: string; size: number }[]
  ) => {
    if (!activeConversationId) return;

    // Prefer REST API — works even when Socket.IO is not connected
    try {
      const res = await fetch(`/api/chat/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, type, isNote, attachments }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        addMessage(data.data);
        qc.invalidateQueries({ queryKey: ["conversations"] });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }

    // Also emit via socket so the visitor widget gets real-time delivery
    if (socket?.connected) {
      socket.emit("message:send", { conversationId: activeConversationId, content, type, isNote, attachments });
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (!activeConversationId || !socket) return;
    socket.emit(isTyping ? "typing:start" : "typing:stop", { conversationId: activeConversationId });
  };

  return (
    <div className="relative flex h-[calc(100vh-4rem-3rem)] -m-6 overflow-hidden border rounded-xl bg-white shadow-sm">
      {/* Floating notification stack */}
      {notifications.length > 0 && (
        <div className="absolute top-3 right-3 z-50 space-y-2 w-80 pointer-events-none">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border shadow-xl p-3 text-sm",
                "animate-in slide-in-from-right-5 duration-300",
                notif.type === "lead" || notif.type === "ticket"
                  ? "bg-emerald-50 border-emerald-200"
                  : notif.type === "agent_request"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-white border-indigo-200"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  notif.type === "lead" || notif.type === "ticket"
                    ? "bg-emerald-100"
                    : notif.type === "agent_request"
                    ? "bg-amber-100"
                    : "bg-indigo-100"
                )}
              >
                {notif.type === "lead" || notif.type === "ticket" ? (
                  <Tag className="w-4 h-4 text-emerald-600" />
                ) : notif.type === "agent_request" ? (
                  <Bell className="w-4 h-4 text-amber-600" />
                ) : (
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-xs leading-tight">{notif.title}</p>
                <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{notif.body}</p>
                {notif.conversationId && (
                  <button
                    className="text-indigo-600 text-xs font-medium mt-1.5 hover:underline"
                    onClick={() => {
                      handleSelectConversation(notif.conversationId!);
                      dismiss(notif.id);
                    }}
                  >
                    View conversation →
                  </button>
                )}
              </div>
              <button
                onClick={() => dismiss(notif.id)}
                className="shrink-0 text-gray-400 hover:text-gray-700 mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConversationList activeId={activeConversationId} onSelect={handleSelectConversation} />

      {activeConversationId ? (
        <>
          <ChatWindow
            conversationId={activeConversationId}
            onSend={handleSendMessage}
            onTyping={handleTyping}
            onToggleDetails={() => setShowDetails(!showDetails)}
            showDetails={showDetails}
            socket={socket}
          />
          {showDetails && <ConversationDetails conversationId={activeConversationId} />}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <p className="text-base font-medium">Select a conversation</p>
            <p className="text-sm mt-1">Choose from the list to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}
