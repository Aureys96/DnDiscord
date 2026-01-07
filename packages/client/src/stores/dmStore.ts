import { create } from "zustand";
import type { Conversation, User } from "@dnd-voice/shared";
import { api } from "../lib/api";

// Flexible DMMessage type that works with both API and Socket responses
export interface StoreDMMessage {
  id: number;
  userId: number;
  recipientId: number;
  content: string;
  timestamp: string;
  type: "dm";
  username: string;
  userRole: string;
}

interface DMState {
  // Conversations
  conversations: Conversation[];
  currentConversation: Conversation | null;

  // Messages for current conversation
  messages: StoreDMMessage[];

  // All users (for starting new conversations)
  users: User[];

  // Typing indicator
  typingUser: { userId: number; username: string } | null;

  // Loading states
  isLoading: boolean;
  isLoadingMessages: boolean;

  // Total unread count
  totalUnreadCount: number;

  // Actions
  fetchConversations: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchMessages: (userId: number) => Promise<void>;
  startConversation: (userId: number) => Promise<Conversation | null>;
  setCurrentConversation: (conversation: Conversation | null) => void;
  addMessage: (message: StoreDMMessage) => void;
  setTypingUser: (user: { userId: number; username: string } | null) => void;
  markAsRead: (userId: number) => Promise<void>;
  updateUnreadCount: () => void;
  clearMessages: () => void;
}

export const useDMStore = create<DMState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  users: [],
  typingUser: null,
  isLoading: false,
  isLoadingMessages: false,
  totalUnreadCount: 0,

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get<{ conversations: Conversation[] }>(
        "/dms/conversations",
      );
      const conversations = response.conversations;
      const totalUnread = conversations.reduce(
        (sum: number, conv: Conversation) => sum + (conv.unreadCount || 0),
        0,
      );
      set({ conversations, totalUnreadCount: totalUnread });
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchUsers: async () => {
    try {
      const response = await api.get<{ users: User[] }>("/users");
      set({ users: response.users });
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  },

  fetchMessages: async (userId: number) => {
    set({ isLoadingMessages: true });
    try {
      const response = await api.get<{ messages: StoreDMMessage[] }>(
        `/dms/${userId}/messages?limit=50`,
      );
      set({ messages: response.messages });
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  startConversation: async (userId: number) => {
    try {
      const response = await api.post<{ conversation: Conversation }>(
        `/dms/conversations/${userId}`,
        {},
      );
      const newConversation = response.conversation;

      // Add to conversations list if not already there
      set((state) => {
        const exists = state.conversations.some(
          (c) => c.id === newConversation.id,
        );
        if (!exists) {
          return { conversations: [newConversation, ...state.conversations] };
        }
        return state;
      });

      return newConversation;
    } catch (error) {
      console.error("Failed to start conversation:", error);
      return null;
    }
  },

  setCurrentConversation: (conversation: Conversation | null) => {
    set({ currentConversation: conversation, messages: [], typingUser: null });
  },

  addMessage: (message: StoreDMMessage) => {
    const { currentConversation } = get();

    // Add to messages if this is for the current conversation
    if (currentConversation) {
      const otherUserId = currentConversation.otherUserId;
      if (
        message.userId === otherUserId ||
        message.recipientId === otherUserId
      ) {
        set((state) => ({
          messages: [...state.messages, message],
        }));
      }
    }

    // Update conversation list (move to top, update last message)
    const otherUserId =
      message.userId === get().currentConversation?.otherUserId
        ? message.userId
        : message.recipientId;

    set((state) => {
      const updatedConversations = state.conversations.map((conv) => {
        if (conv.otherUserId === otherUserId) {
          return {
            ...conv,
            lastMessage: message.content,
            lastMessageAt: message.timestamp,
            // Don't increment unread if it's from current conversation
            unreadCount:
              currentConversation?.otherUserId === otherUserId
                ? conv.unreadCount
                : (conv.unreadCount || 0) +
                  (message.userId === otherUserId ? 1 : 0),
          };
        }
        return conv;
      });

      // Sort by lastMessageAt
      updatedConversations.sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      );

      // Calculate new unread total
      const totalUnread = updatedConversations.reduce(
        (sum: number, conv: Conversation) => sum + (conv.unreadCount || 0),
        0,
      );

      return {
        conversations: updatedConversations,
        totalUnreadCount: totalUnread,
      };
    });
  },

  setTypingUser: (user: { userId: number; username: string } | null) => {
    set({ typingUser: user });
  },

  markAsRead: async (userId: number) => {
    try {
      await api.post(`/dms/${userId}/read`, {});

      // Update local state
      set((state) => {
        const updatedConversations = state.conversations.map((conv) => {
          if (conv.otherUserId === userId) {
            return { ...conv, unreadCount: 0 };
          }
          return conv;
        });
        const totalUnread = updatedConversations.reduce(
          (sum: number, conv: Conversation) => sum + (conv.unreadCount || 0),
          0,
        );
        return {
          conversations: updatedConversations,
          totalUnreadCount: totalUnread,
        };
      });
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  },

  updateUnreadCount: () => {
    const { conversations } = get();
    const totalUnread = conversations.reduce(
      (sum: number, conv: Conversation) => sum + (conv.unreadCount || 0),
      0,
    );
    set({ totalUnreadCount: totalUnread });
  },

  clearMessages: () => {
    set({ messages: [], currentConversation: null, typingUser: null });
  },
}));
