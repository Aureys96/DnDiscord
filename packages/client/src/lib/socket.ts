import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export interface ChatMessage {
  id: number;
  roomId: number | null;
  userId: number;
  content: string;
  timestamp: string;
  type: string;
  username: string;
  userRole: string;
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
    throw new Error('No auth token available');
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

  socket.on('connect', () => {
    console.log('✓ Connected to socket server');
  });

  socket.on('disconnect', (reason) => {
    console.log('✗ Disconnected from socket server:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
    // If token expired or invalid, disconnect and let auth handle it
    if (error.message === 'Token expired' || error.message === 'Invalid token') {
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
  type: 'global' | 'room' = 'global',
  roomId?: number
): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: 'Not connected to server' });
      return;
    }

    socket.emit('send_message', { content, type, roomId }, (response: { success: boolean; message?: ChatMessage; error?: string }) => {
      resolve(response);
    });
  });
}

export function getMessages(
  type: 'global' | 'room' = 'global',
  roomId?: number,
  limit = 50
): Promise<{ success: boolean; messages?: ChatMessage[]; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: 'Not connected to server' });
      return;
    }

    socket.emit('get_messages', { type, roomId, limit }, (response: { success: boolean; messages?: ChatMessage[]; error?: string }) => {
      resolve(response);
    });
  });
}

export function emitTypingStart(roomId?: number): void {
  socket?.emit('typing_start', roomId ? { roomId } : undefined);
}

export function emitTypingStop(roomId?: number): void {
  socket?.emit('typing_stop', roomId ? { roomId } : undefined);
}

export interface RoomUser {
  userId: number;
  username: string;
  role: string;
}

export function joinRoom(
  roomId: number
): Promise<{ success: boolean; roomId?: number; users?: RoomUser[]; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: 'Not connected to server' });
      return;
    }

    socket.emit('join_room', { roomId }, (response: { success: boolean; roomId?: number; users?: RoomUser[]; error?: string }) => {
      resolve(response);
    });
  });
}

export function leaveRoom(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: 'Not connected to server' });
      return;
    }

    socket.emit('leave_room', (response: { success: boolean; error?: string }) => {
      resolve(response);
    });
  });
}

export function getRoomUsers(
  roomId: number
): Promise<{ success: boolean; users?: RoomUser[]; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: 'Not connected to server' });
      return;
    }

    socket.emit('get_room_users', { roomId }, (response: { success: boolean; users?: RoomUser[]; error?: string }) => {
      resolve(response);
    });
  });
}

// DM-related interfaces
export interface DMMessage {
  id: number;
  userId: number;
  recipientId: number;
  content: string;
  timestamp: string;
  type: 'dm';
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
  content: string
): Promise<{ success: boolean; message?: DMMessage; error?: string }> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: false, error: 'Not connected to server' });
      return;
    }

    socket.emit('send_dm', { recipientId, content }, (response: { success: boolean; message?: DMMessage; error?: string }) => {
      resolve(response);
    });
  });
}

export function emitDMTypingStart(recipientId: number): void {
  socket?.emit('dm_typing_start', { recipientId });
}

export function emitDMTypingStop(recipientId: number): void {
  socket?.emit('dm_typing_stop', { recipientId });
}
