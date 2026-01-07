import { create } from "zustand";
import {
  getSocket,
  musicPlay,
  musicPause,
  musicSkip,
  musicAdd,
  musicRemove,
  musicSeek,
  musicSetVolume,
  musicGetState,
  musicSync,
  type MusicScope,
  type MusicTrack,
  type MusicStateChangedEvent,
  type MusicQueueUpdatedEvent,
} from "../lib/socket";

interface MusicStoreState {
  // Current music state
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  isPlaying: boolean;
  volume: number;
  currentPosition: number; // Local tracking

  // Server-side sync data
  startedAt: number | null;
  pausedAt: number | null;

  // Active scope
  activeScope: MusicScope;
  currentRoomId: number | null;
  audioUrl: string | null;

  // UI state
  isExpanded: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions - DM controls
  play: () => Promise<void>;
  pause: () => Promise<void>;
  skip: () => Promise<void>;
  addToQueue: (youtubeUrl: string) => Promise<void>;
  removeFromQueue: (trackId: string) => Promise<void>;
  seek: (position: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;

  // State management
  setScope: (scope: MusicScope, roomId?: number) => void;
  setExpanded: (expanded: boolean) => void;
  updatePosition: (position: number) => void;
  clearError: () => void;

  // Socket listeners
  setupSocketListeners: () => void;
  cleanupSocketListeners: () => void;

  // Initialize
  fetchCurrentState: () => Promise<void>;
  syncWithServer: () => Promise<void>;
}

export const useMusicStore = create<MusicStoreState>((set, get) => ({
  // Initial state
  currentTrack: null,
  queue: [],
  isPlaying: false,
  volume: 50,
  currentPosition: 0,
  startedAt: null,
  pausedAt: null,
  activeScope: "global",
  currentRoomId: null,
  audioUrl: null,
  isExpanded: false,
  isLoading: false,
  error: null,

  // DM Actions
  play: async () => {
    const { activeScope, currentRoomId } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await musicPlay(activeScope, currentRoomId ?? undefined);
      if (!response.success) {
        set({ error: response.error || "Failed to play music" });
      }
    } catch (error) {
      set({ error: "Failed to play music" });
    } finally {
      set({ isLoading: false });
    }
  },

  pause: async () => {
    const { activeScope, currentRoomId } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await musicPause(
        activeScope,
        currentRoomId ?? undefined,
      );
      if (!response.success) {
        set({ error: response.error || "Failed to pause music" });
      }
    } catch (error) {
      set({ error: "Failed to pause music" });
    } finally {
      set({ isLoading: false });
    }
  },

  skip: async () => {
    const { activeScope, currentRoomId } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await musicSkip(activeScope, currentRoomId ?? undefined);
      if (!response.success) {
        set({ error: response.error || "Failed to skip track" });
      }
    } catch (error) {
      set({ error: "Failed to skip track" });
    } finally {
      set({ isLoading: false });
    }
  },

  addToQueue: async (youtubeUrl: string) => {
    const { activeScope, currentRoomId } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await musicAdd(
        youtubeUrl,
        activeScope,
        currentRoomId ?? undefined,
      );
      if (!response.success) {
        set({ error: response.error || "Failed to add song to queue" });
      }
    } catch (error) {
      set({ error: "Failed to add song to queue" });
    } finally {
      set({ isLoading: false });
    }
  },

  removeFromQueue: async (trackId: string) => {
    const { activeScope, currentRoomId } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await musicRemove(
        trackId,
        activeScope,
        currentRoomId ?? undefined,
      );
      if (!response.success) {
        set({ error: response.error || "Failed to remove song from queue" });
      }
    } catch (error) {
      set({ error: "Failed to remove song from queue" });
    } finally {
      set({ isLoading: false });
    }
  },

  seek: async (position: number) => {
    const { activeScope, currentRoomId } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await musicSeek(
        position,
        activeScope,
        currentRoomId ?? undefined,
      );
      if (!response.success) {
        set({ error: response.error || "Failed to seek" });
      }
    } catch (error) {
      set({ error: "Failed to seek" });
    } finally {
      set({ isLoading: false });
    }
  },

  setVolume: async (volume: number) => {
    const { activeScope, currentRoomId } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await musicSetVolume(
        volume,
        activeScope,
        currentRoomId ?? undefined,
      );
      if (!response.success) {
        set({ error: response.error || "Failed to set volume" });
      }
    } catch (error) {
      set({ error: "Failed to set volume" });
    } finally {
      set({ isLoading: false });
    }
  },

  // State management
  setScope: (scope: MusicScope, roomId?: number) => {
    set({
      activeScope: scope,
      currentRoomId: roomId ?? null,
    });
    // Fetch state for new scope
    get().fetchCurrentState();
  },

  setExpanded: (expanded: boolean) => {
    set({ isExpanded: expanded });
  },

  updatePosition: (position: number) => {
    set({ currentPosition: position });
  },

  clearError: () => {
    set({ error: null });
  },

  // Socket listeners
  setupSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    const handleStateChanged = (event: MusicStateChangedEvent) => {
      const { activeScope, currentRoomId } = get();

      // Only update if this event matches our current scope
      const matchesScope =
        (event.scope === "global" && activeScope === "global") ||
        (event.scope === "room" &&
          activeScope === "room" &&
          event.roomId === currentRoomId);

      if (matchesScope) {
        set({
          currentTrack: event.state.currentTrack,
          queue: event.state.queue,
          isPlaying: event.state.isPlaying,
          volume: event.state.volume,
          startedAt: event.state.startedAt,
          pausedAt: event.state.pausedAt,
          audioUrl: event.audioUrl ?? null,
        });
      }
    };

    const handleQueueUpdated = (event: MusicQueueUpdatedEvent) => {
      const { activeScope, currentRoomId } = get();

      // Only update if this event matches our current scope
      const matchesScope =
        (event.scope === "global" && activeScope === "global") ||
        (event.scope === "room" &&
          activeScope === "room" &&
          event.roomId === currentRoomId);

      if (matchesScope) {
        set({ queue: event.queue });
      }
    };

    socket.on("music_state_changed", handleStateChanged);
    socket.on("music_queue_updated", handleQueueUpdated);
  },

  cleanupSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off("music_state_changed");
    socket.off("music_queue_updated");
  },

  // Initialize
  fetchCurrentState: async () => {
    const { currentRoomId } = get();
    set({ isLoading: true, error: null });

    try {
      const response = await musicGetState(currentRoomId ?? undefined);

      if (response.success && response.state) {
        set({
          activeScope: response.scope || "global",
          currentRoomId: response.roomId ?? null,
          currentTrack: response.state.currentTrack,
          queue: response.state.queue,
          isPlaying: response.state.isPlaying,
          volume: response.state.volume,
          startedAt: response.state.startedAt,
          pausedAt: response.state.pausedAt,
          audioUrl: response.audioUrl ?? null,
        });
      }
    } catch (error) {
      set({ error: "Failed to fetch music state" });
    } finally {
      set({ isLoading: false });
    }
  },

  syncWithServer: async () => {
    const { activeScope, currentRoomId } = get();

    try {
      const response = await musicSync(activeScope, currentRoomId ?? undefined);

      if (response.success && response.currentPosition !== undefined) {
        set({
          isPlaying: response.isPlaying ?? false,
          startedAt: response.startedAt ?? null,
          pausedAt: response.pausedAt ?? null,
          currentPosition: response.currentPosition,
        });
      }
    } catch (error) {
      console.error("Failed to sync with server:", error);
    }
  },
}));
