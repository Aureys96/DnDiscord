import { create } from "zustand";
import {
  type ChatMessage,
  type UserTypingEvent,
  connectSocket,
  disconnectSocket,
  sendMessage as socketSendMessage,
  getMessages as socketGetMessages,
  emitTypingStart,
  emitTypingStop,
} from "../lib/socket";

interface ChatState {
  messages: ChatMessage[];
  currentRoomId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  typingUsers: Map<number, string>;
  error: string | null;

  // Actions
  connect: () => void;
  disconnect: () => void;
  sendMessage: (content: string) => Promise<boolean>;
  loadMessages: (roomId?: number | null) => Promise<void>;
  setCurrentRoom: (roomId: number | null) => void;
  setTyping: (isTyping: boolean) => void;
  clearMessages: () => void;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentRoomId: null,
  isConnected: false,
  isConnecting: false,
  typingUsers: new Map(),
  error: null,

  connect: () => {
    if (get().isConnected || get().isConnecting) return;

    set({ isConnecting: true, error: null });

    try {
      const socket = connectSocket();

      socket.on("connect", () => {
        set({ isConnected: true, isConnecting: false });
        // Load message history when connected
        get().loadMessages(get().currentRoomId);
      });

      socket.on("disconnect", () => {
        set({ isConnected: false, isConnecting: false });
      });

      socket.on("connect_error", (error) => {
        set({
          isConnected: false,
          isConnecting: false,
          error: error.message,
        });
      });

      socket.on("new_message", (message: ChatMessage) => {
        const currentRoomId = get().currentRoomId;

        // Only add message if it's for the current context
        // Global messages have roomId: null, room messages have a roomId
        const isForCurrentContext =
          (currentRoomId === null && message.roomId === null) ||
          (currentRoomId !== null && message.roomId === currentRoomId);

        if (isForCurrentContext) {
          set((state) => ({
            messages: [...state.messages, message],
          }));
        }
      });

      socket.on(
        "user_typing",
        (data: UserTypingEvent & { roomId?: number | null }) => {
          const currentRoomId = get().currentRoomId;

          // Only show typing for current context
          const isForCurrentContext =
            (currentRoomId === null && !data.roomId) ||
            (currentRoomId !== null && data.roomId === currentRoomId);

          if (isForCurrentContext) {
            set((state) => {
              const newTypingUsers = new Map(state.typingUsers);
              newTypingUsers.set(data.userId, data.username);
              return { typingUsers: newTypingUsers };
            });
          }
        },
      );

      socket.on(
        "user_stopped_typing",
        (data: { userId: number; roomId?: number | null }) => {
          const currentRoomId = get().currentRoomId;

          const isForCurrentContext =
            (currentRoomId === null && !data.roomId) ||
            (currentRoomId !== null && data.roomId === currentRoomId);

          if (isForCurrentContext) {
            set((state) => {
              const newTypingUsers = new Map(state.typingUsers);
              newTypingUsers.delete(data.userId);
              return { typingUsers: newTypingUsers };
            });
          }
        },
      );
    } catch (error) {
      set({
        isConnecting: false,
        error: error instanceof Error ? error.message : "Failed to connect",
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

    const currentRoomId = get().currentRoomId;
    const type = currentRoomId ? "room" : "global";

    const response = await socketSendMessage(
      trimmed,
      type,
      currentRoomId ?? undefined,
    );

    if (!response.success) {
      set({ error: response.error || "Failed to send message" });
      return false;
    }

    return true;
  },

  loadMessages: async (roomId?: number | null) => {
    // Use provided roomId or current room
    const targetRoomId = roomId !== undefined ? roomId : get().currentRoomId;
    const type = targetRoomId ? "room" : "global";

    const response = await socketGetMessages(
      type,
      targetRoomId ?? undefined,
      50,
    );

    if (response.success && response.messages) {
      set({ messages: response.messages });
    } else if (response.error) {
      set({ error: response.error });
    }
  },

  setCurrentRoom: (roomId: number | null) => {
    set({
      currentRoomId: roomId,
      messages: [],
      typingUsers: new Map(),
    });

    // Load messages for the new room
    if (get().isConnected) {
      get().loadMessages(roomId);
    }
  },

  setTyping: (isTyping: boolean) => {
    const currentRoomId = get().currentRoomId;

    if (isTyping) {
      emitTypingStart(currentRoomId ?? undefined);
    } else {
      emitTypingStop(currentRoomId ?? undefined);
    }
  },

  clearMessages: () => set({ messages: [], typingUsers: new Map() }),

  clearError: () => set({ error: null }),
}));
