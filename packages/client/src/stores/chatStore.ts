import { create } from 'zustand';
import {
  type ChatMessage,
  type UserTypingEvent,
  connectSocket,
  disconnectSocket,
  sendMessage as socketSendMessage,
  getMessages as socketGetMessages,
  emitTypingStart,
  emitTypingStop,
} from '../lib/socket';

interface ChatState {
  messages: ChatMessage[];
  isConnected: boolean;
  isConnecting: boolean;
  typingUsers: Map<number, string>;
  error: string | null;

  // Actions
  connect: () => void;
  disconnect: () => void;
  sendMessage: (content: string) => Promise<boolean>;
  loadMessages: () => Promise<void>;
  setTyping: (isTyping: boolean) => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isConnected: false,
  isConnecting: false,
  typingUsers: new Map(),
  error: null,

  connect: () => {
    if (get().isConnected || get().isConnecting) return;

    set({ isConnecting: true, error: null });

    try {
      const socket = connectSocket();

      socket.on('connect', () => {
        set({ isConnected: true, isConnecting: false });
        // Load message history when connected
        get().loadMessages();
      });

      socket.on('disconnect', () => {
        set({ isConnected: false, isConnecting: false });
      });

      socket.on('connect_error', (error) => {
        set({
          isConnected: false,
          isConnecting: false,
          error: error.message,
        });
      });

      socket.on('new_message', (message: ChatMessage) => {
        set((state) => ({
          messages: [...state.messages, message],
        }));
      });

      socket.on('user_typing', (data: UserTypingEvent) => {
        set((state) => {
          const newTypingUsers = new Map(state.typingUsers);
          newTypingUsers.set(data.userId, data.username);
          return { typingUsers: newTypingUsers };
        });
      });

      socket.on('user_stopped_typing', (data: { userId: number }) => {
        set((state) => {
          const newTypingUsers = new Map(state.typingUsers);
          newTypingUsers.delete(data.userId);
          return { typingUsers: newTypingUsers };
        });
      });
    } catch (error) {
      set({
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      });
    }
  },

  disconnect: () => {
    disconnectSocket();
    set({
      isConnected: false,
      isConnecting: false,
      messages: [],
      typingUsers: new Map(),
    });
  },

  sendMessage: async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return false;

    const response = await socketSendMessage(trimmed);

    if (!response.success) {
      set({ error: response.error || 'Failed to send message' });
      return false;
    }

    return true;
  },

  loadMessages: async () => {
    const response = await socketGetMessages('global', undefined, 50);

    if (response.success && response.messages) {
      set({ messages: response.messages });
    } else if (response.error) {
      set({ error: response.error });
    }
  },

  setTyping: (isTyping: boolean) => {
    if (isTyping) {
      emitTypingStart();
    } else {
      emitTypingStop();
    }
  },

  clearError: () => set({ error: null }),
}));
