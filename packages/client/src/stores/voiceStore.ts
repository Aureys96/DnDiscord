import { create } from 'zustand';
import {
  getSocket,
  joinVoice,
  leaveVoice,
  emitVoiceStateUpdate,
  emitVoiceSpeaking,
  getVoiceUsers as fetchVoiceUsers,
  type VoiceUser,
  type VoiceUserJoinedEvent,
  type VoiceUserLeftEvent,
  type VoiceStateChangedEvent,
  type VoiceSpeakingChangedEvent,
} from '../lib/socket';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

export interface VoiceState {
  // State
  isInVoice: boolean;
  currentRoomId: number | null;
  isMuted: boolean;
  voiceUsers: Map<number, VoiceUser>;
  connectionStates: Map<number, ConnectionState>;
  error: string | null;

  // Actions
  joinVoiceChannel: (roomId: number) => Promise<VoiceUser[]>;
  leaveVoiceChannel: () => Promise<void>;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  updateUserState: (userId: number, updates: Partial<VoiceUser>) => void;
  setConnectionState: (userId: number, state: ConnectionState) => void;
  addVoiceUser: (user: VoiceUser) => void;
  removeVoiceUser: (userId: number) => void;
  clearVoiceState: () => void;
  setupSocketListeners: (currentUserId: number) => void;
  cleanupSocketListeners: () => void;
  fetchVoiceUsers: (roomId: number) => Promise<void>;
  handleRoomChange: (newRoomId: number | null) => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  // Initial state
  isInVoice: false,
  currentRoomId: null,
  isMuted: false,
  voiceUsers: new Map(),
  connectionStates: new Map(),
  error: null,

  // Join voice channel
  joinVoiceChannel: async (roomId: number) => {
    const response = await joinVoice(roomId);

    if (!response.success) {
      set({ error: response.error || 'Failed to join voice channel' });
      throw new Error(response.error || 'Failed to join voice channel');
    }

    // Add existing voice users to state
    const existingUsers = response.voiceUsers || [];
    const voiceUsersMap = new Map<number, VoiceUser>();
    for (const user of existingUsers) {
      voiceUsersMap.set(user.userId, user);
    }

    set({
      isInVoice: true,
      currentRoomId: roomId,
      voiceUsers: voiceUsersMap,
      error: null,
    });

    return existingUsers;
  },

  // Leave voice channel
  leaveVoiceChannel: async () => {
    const { currentRoomId } = get();
    if (!currentRoomId) return;

    await leaveVoice(currentRoomId);

    set({
      isInVoice: false,
      currentRoomId: null,
      voiceUsers: new Map(),
      connectionStates: new Map(),
      error: null,
    });
  },

  // Toggle mute
  toggleMute: () => {
    const { isMuted, currentRoomId } = get();
    const newMuted = !isMuted;

    set({ isMuted: newMuted });

    if (currentRoomId) {
      emitVoiceStateUpdate(currentRoomId, newMuted);
    }
  },

  // Set muted state (for PTT)
  setMuted: (muted: boolean) => {
    const { currentRoomId } = get();

    set({ isMuted: muted });

    if (currentRoomId) {
      emitVoiceStateUpdate(currentRoomId, muted);
    }
  },

  // Set speaking state
  setSpeaking: (speaking: boolean) => {
    const { currentRoomId } = get();

    if (currentRoomId) {
      emitVoiceSpeaking(currentRoomId, speaking);
    }
  },

  // Update a voice user's state
  updateUserState: (userId: number, updates: Partial<VoiceUser>) => {
    const { voiceUsers } = get();
    const user = voiceUsers.get(userId);

    if (user) {
      const updatedUser = { ...user, ...updates };
      const newVoiceUsers = new Map(voiceUsers);
      newVoiceUsers.set(userId, updatedUser);
      set({ voiceUsers: newVoiceUsers });
    }
  },

  // Set connection state for a peer
  setConnectionState: (userId: number, state: ConnectionState) => {
    const { connectionStates } = get();
    const newConnectionStates = new Map(connectionStates);
    newConnectionStates.set(userId, state);
    set({ connectionStates: newConnectionStates });
  },

  // Add a voice user
  addVoiceUser: (user: VoiceUser) => {
    const { voiceUsers } = get();
    const newVoiceUsers = new Map(voiceUsers);
    newVoiceUsers.set(user.userId, user);
    set({ voiceUsers: newVoiceUsers });
  },

  // Remove a voice user
  removeVoiceUser: (userId: number) => {
    const { voiceUsers, connectionStates } = get();
    const newVoiceUsers = new Map(voiceUsers);
    const newConnectionStates = new Map(connectionStates);
    newVoiceUsers.delete(userId);
    newConnectionStates.delete(userId);
    set({ voiceUsers: newVoiceUsers, connectionStates: newConnectionStates });
  },

  // Clear all voice state
  clearVoiceState: () => {
    set({
      isInVoice: false,
      currentRoomId: null,
      isMuted: false,
      voiceUsers: new Map(),
      connectionStates: new Map(),
      error: null,
    });
  },

  // Fetch voice users for a room
  fetchVoiceUsers: async (roomId: number) => {
    const response = await fetchVoiceUsers(roomId);

    if (response.success && response.voiceUsers) {
      const voiceUsersMap = new Map<number, VoiceUser>();
      for (const user of response.voiceUsers) {
        voiceUsersMap.set(user.userId, user);
      }
      set({ voiceUsers: voiceUsersMap });
    }
  },

  // Setup socket event listeners
  setupSocketListeners: (currentUserId: number) => {
    const socket = getSocket();
    if (!socket) return;

    // User joined voice
    socket.on('voice_user_joined', (event: VoiceUserJoinedEvent) => {
      const { currentRoomId } = get();
      if (event.roomId === currentRoomId) {
        get().addVoiceUser(event.user);
      }
    });

    // User left voice
    socket.on('voice_user_left', (event: VoiceUserLeftEvent) => {
      const { currentRoomId, isInVoice } = get();
      if (event.roomId === currentRoomId) {
        get().removeVoiceUser(event.userId);

        // If this is the current user being kicked (e.g., room switch auto-leave)
        if (event.userId === currentUserId && isInVoice) {
          console.log('✗ Auto-left voice channel (server-side)');
          get().clearVoiceState();
        }
      }
    });

    // User mute state changed
    socket.on('voice_state_changed', (event: VoiceStateChangedEvent) => {
      const { currentRoomId } = get();
      if (event.roomId === currentRoomId) {
        get().updateUserState(event.userId, { isMuted: event.isMuted });
      }
    });

    // User speaking state changed
    socket.on('voice_speaking_changed', (event: VoiceSpeakingChangedEvent) => {
      const { currentRoomId } = get();
      if (event.roomId === currentRoomId) {
        get().updateUserState(event.userId, { isSpeaking: event.isSpeaking });
      }
    });
  },

  // Cleanup socket event listeners
  cleanupSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off('voice_user_joined');
    socket.off('voice_user_left');
    socket.off('voice_state_changed');
    socket.off('voice_speaking_changed');
  },

  // Handle room change - cleanup voice if switching rooms
  handleRoomChange: (newRoomId: number | null) => {
    const { isInVoice, currentRoomId } = get();

    // If in voice and switching to a different room, clear voice state
    // The server will handle the actual voice_leave, we just need to clean up client state
    if (isInVoice && currentRoomId !== null && currentRoomId !== newRoomId) {
      console.log(`Room changed from ${currentRoomId} to ${newRoomId}, voice will be auto-left by server`);
      // Note: We don't need to call leaveVoiceChannel here because
      // the server auto-leaves voice when switching rooms and sends voice_user_left event
      // The socket listener will call clearVoiceState when it receives that event
    }
  },
}));
