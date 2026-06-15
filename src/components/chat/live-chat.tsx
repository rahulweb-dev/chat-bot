"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "@/store/chat-store";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { ConversationDetails } from "./conversation-details";
import { cn } from "@/lib/utils";

let socket: Socket | null = null;

export function LiveChat() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [showDetails, setShowDetails] = useState(true);
  const {
    activeConversationId,
    setActiveConversation,
    addMessage,
    updateConversation,
    addConversation,
    setTyping,
  } = useChatStore();

  useEffect(() => {
    if (!session?.user || socket) return;

    const token = (session as { accessToken?: string }).accessToken || "";
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "", {
      auth: { token: session?.user?.id },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("Socket connected");
      socket?.emit("agent:status", { status: "online" });
    });

    socket.on("message:new", (message) => {
      addMessage(message);
      updateConversation(message.conversationId, {
        lastMessageAt: message.createdAt,
      });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    });

    socket.on("conversation:new", (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    });

    socket.on("conversation:updated", (data) => {
      updateConversation(data.conversationId, {
        lastMessageAt: data.lastMessageAt,
      });
    });

    socket.on("conversation:assigned", (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
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
  }, [session]);

  const handleSelectConversation = (id: string) => {
    if (activeConversationId) {
      socket?.emit("leave:conversation", activeConversationId);
    }
    setActiveConversation(id);
    socket?.emit("join:conversation", id);
  };

  const handleSendMessage = (content: string, type: string = "TEXT", isNote: boolean = false, attachments?: { name: string; url: string; type: string; size: number }[]) => {
    if (!activeConversationId || !socket) return;
    socket.emit("message:send", {
      conversationId: activeConversationId,
      content,
      type,
      isNote,
      attachments,
    });
  };

  const handleTyping = (isTyping: boolean) => {
    if (!activeConversationId || !socket) return;
    socket.emit(isTyping ? "typing:start" : "typing:stop", {
      conversationId: activeConversationId,
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem-3rem)] -m-6 overflow-hidden border rounded-xl bg-white shadow-sm">
      <ConversationList
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
      />
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
          {showDetails && (
            <ConversationDetails conversationId={activeConversationId} />
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
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
