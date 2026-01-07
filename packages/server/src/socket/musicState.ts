/**
 * Music State Management
 * Tracks global and per-room music playback state
 */

export interface MusicTrack {
  id: string;
  youtubeUrl: string;
  title: string;
  duration: number; // seconds
  thumbnailUrl?: string;
  addedBy: number;
  addedByUsername: string;
}

export interface MusicState {
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  isPlaying: boolean;
  startedAt: number | null; // Unix timestamp when playback started
  pausedAt: number | null; // Position in seconds when paused
  volume: number; // 0-100
}

// Global music state (default)
let globalMusicState: MusicState = createEmptyState();

// Per-room music states: roomId -> MusicState
const roomMusicStates = new Map<number, MusicState>();

/**
 * Create an empty music state
 */
function createEmptyState(): MusicState {
  return {
    currentTrack: null,
    queue: [],
    isPlaying: false,
    startedAt: null,
    pausedAt: null,
    volume: 50,
  };
}

/**
 * Get the global music state
 */
export function getGlobalMusicState(): MusicState {
  return { ...globalMusicState };
}

/**
 * Get a room's music state (or null if none)
 */
export function getRoomMusicState(roomId: number): MusicState | null {
  const state = roomMusicStates.get(roomId);
  return state ? { ...state } : null;
}

/**
 * Check if a room has active music
 */
export function hasRoomMusic(roomId: number): boolean {
  const state = roomMusicStates.get(roomId);
  return state?.currentTrack !== null || (state?.queue.length ?? 0) > 0;
}

/**
 * Get effective music state for a user
 * Room music takes priority if user is in a room with active music
 */
export function getEffectiveMusicState(roomId: number | null): {
  state: MusicState;
  scope: "global" | "room";
  roomId?: number;
} {
  if (roomId !== null && hasRoomMusic(roomId)) {
    const roomState = getRoomMusicState(roomId);
    if (roomState) {
      return { state: roomState, scope: "room", roomId };
    }
  }
  return { state: getGlobalMusicState(), scope: "global" };
}

/**
 * Calculate current playback position
 */
export function getCurrentPosition(state: MusicState): number {
  if (!state.currentTrack) return 0;

  if (state.isPlaying && state.startedAt !== null) {
    return (Date.now() - state.startedAt) / 1000;
  }

  return state.pausedAt ?? 0;
}

// ==================== Global State Mutations ====================

/**
 * Set global music state
 */
export function setGlobalMusicState(updates: Partial<MusicState>): MusicState {
  globalMusicState = { ...globalMusicState, ...updates };
  return { ...globalMusicState };
}

/**
 * Add track to global queue
 */
export function addToGlobalQueue(track: MusicTrack): MusicState {
  globalMusicState.queue.push(track);
  return { ...globalMusicState };
}

/**
 * Remove track from global queue
 */
export function removeFromGlobalQueue(trackId: string): MusicState {
  globalMusicState.queue = globalMusicState.queue.filter(
    (t) => t.id !== trackId,
  );
  return { ...globalMusicState };
}

/**
 * Play global music
 */
export function playGlobalMusic(): MusicState {
  if (!globalMusicState.currentTrack && globalMusicState.queue.length > 0) {
    // Start playing first track in queue
    globalMusicState.currentTrack = globalMusicState.queue.shift()!;
  }

  if (globalMusicState.currentTrack) {
    const resumePosition = globalMusicState.pausedAt ?? 0;
    globalMusicState.isPlaying = true;
    globalMusicState.startedAt = Date.now() - resumePosition * 1000;
    globalMusicState.pausedAt = null;
  }

  return { ...globalMusicState };
}

/**
 * Pause global music
 */
export function pauseGlobalMusic(): MusicState {
  if (globalMusicState.isPlaying && globalMusicState.startedAt !== null) {
    globalMusicState.pausedAt = getCurrentPosition(globalMusicState);
    globalMusicState.isPlaying = false;
    globalMusicState.startedAt = null;
  }
  return { ...globalMusicState };
}

/**
 * Skip to next track in global queue
 */
export function skipGlobalTrack(): MusicState {
  if (globalMusicState.queue.length > 0) {
    globalMusicState.currentTrack = globalMusicState.queue.shift()!;
    globalMusicState.startedAt = Date.now();
    globalMusicState.pausedAt = null;
    globalMusicState.isPlaying = true;
  } else {
    globalMusicState.currentTrack = null;
    globalMusicState.isPlaying = false;
    globalMusicState.startedAt = null;
    globalMusicState.pausedAt = null;
  }
  return { ...globalMusicState };
}

/**
 * Seek global music to position
 */
export function seekGlobalMusic(position: number): MusicState {
  if (globalMusicState.currentTrack) {
    if (globalMusicState.isPlaying) {
      globalMusicState.startedAt = Date.now() - position * 1000;
    } else {
      globalMusicState.pausedAt = position;
    }
  }
  return { ...globalMusicState };
}

/**
 * Set global volume
 */
export function setGlobalVolume(volume: number): MusicState {
  globalMusicState.volume = Math.max(0, Math.min(100, volume));
  return { ...globalMusicState };
}

// ==================== Room State Mutations ====================

/**
 * Ensure room has a music state
 */
function ensureRoomState(roomId: number): MusicState {
  if (!roomMusicStates.has(roomId)) {
    roomMusicStates.set(roomId, createEmptyState());
  }
  return roomMusicStates.get(roomId)!;
}

/**
 * Set room music state
 */
export function setRoomMusicState(
  roomId: number,
  updates: Partial<MusicState>,
): MusicState {
  const state = ensureRoomState(roomId);
  const updatedState = { ...state, ...updates };
  roomMusicStates.set(roomId, updatedState);
  return { ...updatedState };
}

/**
 * Add track to room queue
 */
export function addToRoomQueue(roomId: number, track: MusicTrack): MusicState {
  const state = ensureRoomState(roomId);
  state.queue.push(track);
  return { ...state };
}

/**
 * Remove track from room queue
 */
export function removeFromRoomQueue(
  roomId: number,
  trackId: string,
): MusicState {
  const state = ensureRoomState(roomId);
  state.queue = state.queue.filter((t) => t.id !== trackId);
  return { ...state };
}

/**
 * Play room music
 */
export function playRoomMusic(roomId: number): MusicState {
  const state = ensureRoomState(roomId);

  if (!state.currentTrack && state.queue.length > 0) {
    state.currentTrack = state.queue.shift()!;
  }

  if (state.currentTrack) {
    const resumePosition = state.pausedAt ?? 0;
    state.isPlaying = true;
    state.startedAt = Date.now() - resumePosition * 1000;
    state.pausedAt = null;
  }

  return { ...state };
}

/**
 * Pause room music
 */
export function pauseRoomMusic(roomId: number): MusicState {
  const state = roomMusicStates.get(roomId);
  if (!state) return createEmptyState();

  if (state.isPlaying && state.startedAt !== null) {
    state.pausedAt = getCurrentPosition(state);
    state.isPlaying = false;
    state.startedAt = null;
  }
  return { ...state };
}

/**
 * Skip to next track in room queue
 */
export function skipRoomTrack(roomId: number): MusicState {
  const state = roomMusicStates.get(roomId);
  if (!state) return createEmptyState();

  if (state.queue.length > 0) {
    state.currentTrack = state.queue.shift()!;
    state.startedAt = Date.now();
    state.pausedAt = null;
    state.isPlaying = true;
  } else {
    state.currentTrack = null;
    state.isPlaying = false;
    state.startedAt = null;
    state.pausedAt = null;
  }
  return { ...state };
}

/**
 * Seek room music to position
 */
export function seekRoomMusic(roomId: number, position: number): MusicState {
  const state = roomMusicStates.get(roomId);
  if (!state || !state.currentTrack) return state || createEmptyState();

  if (state.isPlaying) {
    state.startedAt = Date.now() - position * 1000;
  } else {
    state.pausedAt = position;
  }
  return { ...state };
}

/**
 * Set room volume
 */
export function setRoomVolume(roomId: number, volume: number): MusicState {
  const state = ensureRoomState(roomId);
  state.volume = Math.max(0, Math.min(100, volume));
  return { ...state };
}

/**
 * Clear room music state
 */
export function clearRoomMusicState(roomId: number): void {
  roomMusicStates.delete(roomId);
}

/**
 * Clear all music state (for testing only)
 */
export function clearAllMusicState(): void {
  globalMusicState = createEmptyState();
  roomMusicStates.clear();
}

/**
 * Generate unique track ID
 */
export function generateTrackId(): string {
  return `track_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
