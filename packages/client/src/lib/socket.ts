import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../stores/authStore";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

let socket: Socket | null = null;

export interface DiceRollResult {
  formula: string;
  rolls: Array<{
    dice: string;
    results: number[];
    kept?: number[];
    subtotal: number;
  }>;
  modifier: number;
  total: number;
  criticalHit?: boolean;
  criticalMiss?: boolean;
}

export interface ChatMessage {
  id: number;
  roomId: number | null;
  userId: number;
  content: string;
  timestamp: string;
  type: string;
  username: string;
  userRole: string;
  rollResult?: DiceRollResult;
}

export interface UserJoinedEvent {
  userId: number;
  username: string;
  role: string;
}

export interface UserLeftEvent {
  userId: number;
  username: string;
}

export interface UserTypingEvent {
  userId: number;
  username: string;
}

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  const token = useAuthStore.getState().token;

  if (!token) {
    throw new Error("No auth token available");
  }

  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("✓ Connected to socket server");
  });

  socket.on("disconnect", (reason) => {
    console.log("✗ Disconnected from socket server:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
    // If token expired or invalid, disconnect and let auth handle it
    if (
      error.message === "Token expired" ||
      error.message === "Invalid token"
    ) {
      disconnectSocket();
    }
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function sendMessage(
  content: string,
  type: "global" | "room" = "global",
  roomId?: number,
): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "send_message",
      { content, type, roomId },
      (response: {
        success: boolean;
        message?: ChatMessage;
        error?: string;
      }) => {
        resolve(response);
      },
    );
  });
}

export function getMessages(
  type: "global" | "room" = "global",
  roomId?: number,
  limit = 50,
): Promise<{ success: boolean; messages?: ChatMessage[]; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "get_messages",
      { type, roomId, limit },
      (response: {
        success: boolean;
        messages?: ChatMessage[];
        error?: string;
      }) => {
        resolve(response);
      },
    );
  });
}

export function emitTypingStart(roomId?: number): void {
  socket?.emit("typing_start", roomId ? { roomId } : undefined);
}

export function emitTypingStop(roomId?: number): void {
  socket?.emit("typing_stop", roomId ? { roomId } : undefined);
}

export interface RoomUser {
  userId: number;
  username: string;
  role: string;
}

export function joinRoom(roomId: number): Promise<{
  success: boolean;
  roomId?: number;
  users?: RoomUser[];
  error?: string;
}> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "join_room",
      { roomId },
      (response: {
        success: boolean;
        roomId?: number;
        users?: RoomUser[];
        error?: string;
      }) => {
        resolve(response);
      },
    );
  });
}

export function leaveRoom(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "leave_room",
      (response: { success: boolean; error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function getRoomUsers(
  roomId: number,
): Promise<{ success: boolean; users?: RoomUser[]; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "get_room_users",
      { roomId },
      (response: { success: boolean; users?: RoomUser[]; error?: string }) => {
        resolve(response);
      },
    );
  });
}

// DM-related interfaces
export interface DMMessage {
  id: number;
  userId: number;
  recipientId: number;
  content: string;
  timestamp: string;
  type: "dm";
  username: string;
  userRole: string;
}

export interface DMTypingEvent {
  userId: number;
  username: string;
}

// DM-related functions
export function sendDM(
  recipientId: number,
  content: string,
): Promise<{ success: boolean; message?: DMMessage; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "send_dm",
      { recipientId, content },
      (response: { success: boolean; message?: DMMessage; error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function emitDMTypingStart(recipientId: number): void {
  socket?.emit("dm_typing_start", { recipientId });
}

export function emitDMTypingStop(recipientId: number): void {
  socket?.emit("dm_typing_stop", { recipientId });
}

// ==================== Voice Channel Types ====================

export interface VoiceUser {
  userId: number;
  username: string;
  role: "dm" | "player";
  isMuted: boolean;
  isSpeaking: boolean;
}

export interface VoiceUserJoinedEvent {
  roomId: number;
  user: VoiceUser;
}

export interface VoiceUserLeftEvent {
  roomId: number;
  userId: number;
  username: string;
}

export interface VoiceOfferEvent {
  fromUserId: number;
  fromUsername: string;
  offer: RTCSessionDescriptionInit;
}

export interface VoiceAnswerEvent {
  fromUserId: number;
  answer: RTCSessionDescriptionInit;
}

export interface VoiceIceCandidateEvent {
  fromUserId: number;
  candidate: RTCIceCandidateInit;
}

export interface VoiceStateChangedEvent {
  roomId: number;
  userId: number;
  isMuted: boolean;
}

export interface VoiceSpeakingChangedEvent {
  roomId: number;
  userId: number;
  isSpeaking: boolean;
}

// ==================== Voice Channel Functions ====================

export function joinVoice(roomId: number): Promise<{
  success: boolean;
  roomId?: number;
  voiceUsers?: VoiceUser[];
  error?: string;
}> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "voice_join",
      { roomId },
      (response: {
        success: boolean;
        roomId?: number;
        voiceUsers?: VoiceUser[];
        error?: string;
      }) => {
        resolve(response);
      },
    );
  });
}

export function leaveVoice(
  roomId: number,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "voice_leave",
      { roomId },
      (response: { success: boolean; error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function sendVoiceOffer(
  targetUserId: number,
  offer: RTCSessionDescriptionInit,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "voice_offer",
      { targetUserId, offer },
      (response: { success: boolean; error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function sendVoiceAnswer(
  targetUserId: number,
  answer: RTCSessionDescriptionInit,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "voice_answer",
      { targetUserId, answer },
      (response: { success: boolean; error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function sendVoiceIceCandidate(
  targetUserId: number,
  candidate: RTCIceCandidateInit,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "voice_ice_candidate",
      { targetUserId, candidate },
      (response: { success: boolean; error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function emitVoiceStateUpdate(roomId: number, isMuted: boolean): void {
  socket?.emit("voice_state_update", { roomId, isMuted });
}

export function emitVoiceSpeaking(roomId: number, isSpeaking: boolean): void {
  socket?.emit("voice_speaking", { roomId, isSpeaking });
}

export function getVoiceUsers(
  roomId: number,
): Promise<{ success: boolean; voiceUsers?: VoiceUser[]; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "voice_get_users",
      { roomId },
      (response: {
        success: boolean;
        voiceUsers?: VoiceUser[];
        error?: string;
      }) => {
        resolve(response);
      },
    );
  });
}

// ==================== Music Types ====================

export type MusicScope = "global" | "room";

export interface MusicTrack {
  id: string;
  youtubeUrl: string;
  title: string;
  duration: number;
  thumbnailUrl?: string;
  addedBy: number;
  addedByUsername: string;
}

export interface MusicState {
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  isPlaying: boolean;
  startedAt: number | null;
  pausedAt: number | null;
  volume: number;
}

export interface MusicStateChangedEvent {
  scope: MusicScope;
  roomId?: number;
  state: MusicState;
  audioUrl?: string;
}

export interface MusicQueueUpdatedEvent {
  scope: MusicScope;
  roomId?: number;
  queue: MusicTrack[];
}

// ==================== Music Functions ====================

export function musicPlay(
  scope: MusicScope,
  roomId?: number,
): Promise<{ success: boolean; state?: MusicState; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "music_play",
      { scope, roomId },
      (response: { success: boolean; state?: MusicState; error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function musicPause(
  scope: MusicScope,
  roomId?: number,
): Promise<{ success: boolean; state?: MusicState; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "music_pause",
      { scope, roomId },
      (response: { success: boolean; state?: MusicState; error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function musicSkip(
  scope: MusicScope,
  roomId?: number,
): Promise<{ success: boolean; state?: MusicState; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "music_skip",
      { scope, roomId },
      (response: { success: boolean; state?: MusicState; error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function musicAdd(
  youtubeUrl: string,
  scope: MusicScope,
  roomId?: number,
): Promise<{
  success: boolean;
  track?: MusicTrack;
  state?: MusicState;
  error?: string;
}> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "music_add",
      { youtubeUrl, scope, roomId },
      (response: {
        success: boolean;
        track?: MusicTrack;
        state?: MusicState;
        error?: string;
      }) => {
        resolve(response);
      },
    );
  });
}

export function musicRemove(
  trackId: string,
  scope: MusicScope,
  roomId?: number,
): Promise<{ success: boolean; state?: MusicState; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "music_remove",
      { trackId, scope, roomId },
      (response: { success: boolean; state?: MusicState; error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function musicSeek(
  position: number,
  scope: MusicScope,
  roomId?: number,
): Promise<{ success: boolean; state?: MusicState; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "music_seek",
      { position, scope, roomId },
      (response: { success: boolean; state?: MusicState; error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function musicSetVolume(
  volume: number,
  scope: MusicScope,
  roomId?: number,
): Promise<{ success: boolean; state?: MusicState; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "music_volume",
      { volume, scope, roomId },
      (response: { success: boolean; state?: MusicState; error?: string }) => {
        resolve(response);
      },
    );
  });
}

export function musicGetState(roomId?: number): Promise<{
  success: boolean;
  scope?: MusicScope;
  roomId?: number;
  state?: MusicState;
  audioUrl?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "music_get_state",
      { roomId },
      (response: {
        success: boolean;
        scope?: MusicScope;
        roomId?: number;
        state?: MusicState;
        audioUrl?: string;
        error?: string;
      }) => {
        resolve(response);
      },
    );
  });
}

export function musicSync(
  scope: MusicScope,
  roomId?: number,
): Promise<{
  success: boolean;
  isPlaying?: boolean;
  startedAt?: number | null;
  pausedAt?: number | null;
  currentPosition?: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    socket.emit(
      "music_sync",
      { scope, roomId },
      (response: {
        success: boolean;
        isPlaying?: boolean;
        startedAt?: number | null;
        pausedAt?: number | null;
        currentPosition?: number;
        error?: string;
      }) => {
        resolve(response);
      },
    );
  });
}
