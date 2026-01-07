import { create } from "zustand";
import type { Room } from "@dnd-voice/shared";
import { api } from "../lib/api";
import {
  type RoomUser,
  joinRoom as socketJoinRoom,
  leaveRoom as socketLeaveRoom,
  getSocket,
} from "../lib/socket";

interface RoomState {
  rooms: Room[];
  currentRoomId: number | null;
  roomUsers: RoomUser[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchRooms: () => Promise<void>;
  createRoom: (name: string) => Promise<Room | null>;
  deleteRoom: (roomId: number) => Promise<boolean>;
  joinRoom: (roomId: number) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  setCurrentRoomId: (roomId: number | null) => void;
  clearError: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  currentRoomId: null,
  roomUsers: [],
  isLoading: false,
  error: null,

  fetchRooms: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.fetch("/rooms");

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch rooms");
      }

      const data = await response.json();
      set({ rooms: data.rooms, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to fetch rooms",
      });
    }
  },

  createRoom: async (name: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.fetch("/rooms", {
        method: "POST",
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create room");
      }

      const data = await response.json();
      const newRoom = data.room as Room;

      set((state) => ({
        rooms: [newRoom, ...state.rooms],
        isLoading: false,
      }));

      return newRoom;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to create room",
      });
      return null;
    }
  },

  deleteRoom: async (roomId: number) => {
    set({ error: null });

    try {
      const response = await api.fetch(`/rooms/${roomId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete room");
      }

      // If we're in the deleted room, leave it
      if (get().currentRoomId === roomId) {
        await get().leaveRoom();
      }

      set((state) => ({
        rooms: state.rooms.filter((r) => r.id !== roomId),
      }));

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to delete room",
      });
      return false;
    }
  },

  joinRoom: async (roomId: number) => {
    const currentRoomId = get().currentRoomId;

    // Already in this room
    if (currentRoomId === roomId) {
      return true;
    }

    set({ error: null });

    try {
      const response = await socketJoinRoom(roomId);

      if (!response.success) {
        throw new Error(response.error || "Failed to join room");
      }

      set({
        currentRoomId: roomId,
        roomUsers: response.users || [],
      });

      // Set up room user listeners
      const socket = getSocket();
      if (socket) {
        socket.on(
          "user_joined_room",
          (data: {
            userId: number;
            username: string;
            role: string;
            roomId: number;
          }) => {
            if (data.roomId === get().currentRoomId) {
              set((state) => ({
                roomUsers: [
                  ...state.roomUsers.filter((u) => u.userId !== data.userId),
                  {
                    userId: data.userId,
                    username: data.username,
                    role: data.role,
                  },
                ],
              }));
            }
          },
        );

        socket.on(
          "user_left_room",
          (data: { userId: number; roomId: number }) => {
            if (data.roomId === get().currentRoomId) {
              set((state) => ({
                roomUsers: state.roomUsers.filter(
                  (u) => u.userId !== data.userId,
                ),
              }));
            }
          },
        );
      }

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to join room",
      });
      return false;
    }
  },

  leaveRoom: async () => {
    const currentRoomId = get().currentRoomId;

    if (currentRoomId === null) {
      return;
    }

    try {
      await socketLeaveRoom();

      // Remove room user listeners
      const socket = getSocket();
      if (socket) {
        socket.off("user_joined_room");
        socket.off("user_left_room");
      }

      set({
        currentRoomId: null,
        roomUsers: [],
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to leave room",
      });
    }
  },

  setCurrentRoomId: (roomId: number | null) => {
    set({ currentRoomId: roomId });
  },

  clearError: () => set({ error: null }),
}));
