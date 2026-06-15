import { create } from "zustand";

interface Message {
  _id: string;
  conversationId: string;
  content: string;
  senderType: "AGENT" | "VISITOR" | "BOT" | "SYSTEM";
  senderId?: { _id: string; name: string; avatar?: string };
  type: string;
  isNote: boolean;
  isRead: boolean;
  isDelivered?: boolean;
  createdAt: string;
  attachments?: { name: string; url: string; type: string; size: number }[];
}

interface Conversation {
  _id: string;
  status: string;
  visitor: { name?: string; email?: string; visitorId: string };
  assignedTo?: { _id: string; name: string; avatar?: string };
  lastMessageAt?: string;
  messageCount: number;
  tags: string[];
  priority: string;
}

interface TypingUser {
  userId: string;
  conversationId: string;
}

interface ChatStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: TypingUser[];
  unreadCounts: Record<string, number>;

  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setTyping: (userId: string, conversationId: string, isTyping: boolean) => void;
  incrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  typingUsers: [],
  unreadCounts: {},

  setConversations: (conversations) => set({ conversations }),
  addConversation: (conversation) =>
    set((state) => ({ conversations: [conversation, ...state.conversations] })),
  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === id ? { ...c, ...updates } : c
      ),
    })),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (conversationId, messages) =>
    set((state) => ({ messages: { ...state.messages, [conversationId]: messages } })),
  addMessage: (message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [message.conversationId]: [
          ...(state.messages[message.conversationId] || []),
          message,
        ],
      },
    })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: Object.fromEntries(
        Object.entries(state.messages).map(([convId, msgs]) => [
          convId,
          msgs.map((m) => (m._id === id ? { ...m, ...updates } : m)),
        ])
      ),
    })),
  setTyping: (userId, conversationId, isTyping) =>
    set((state) => ({
      typingUsers: isTyping
        ? [...state.typingUsers.filter((t) => t.userId !== userId), { userId, conversationId }]
        : state.typingUsers.filter((t) => t.userId !== userId),
    })),
  incrementUnread: (conversationId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [conversationId]: (state.unreadCounts[conversationId] || 0) + 1,
      },
    })),
  clearUnread: (conversationId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [conversationId]: 0 },
    })),
}));
