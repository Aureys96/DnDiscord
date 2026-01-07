import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getMessageQueries, getDMQueries, getConversationQueries, getUserQueries } from '../db/index.js';
import { extractDiceCommand, parseAndRoll, formatRollResult, type DiceRollResult } from '@dnd-voice/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-please-change-in-production';

interface JWTPayload {
  userId: number;
  username: string;
  role: 'dm' | 'player';
}

interface AuthenticatedSocket extends Socket {
  user: {
    id: number;
    username: string;
    role: 'dm' | 'player';
  };
}

interface SendMessagePayload {
  content: string;
  type?: 'global' | 'room';
  roomId?: number;
}

interface SendDMPayload {
  recipientId: number;
  content: string;
}

interface DMMessageResponse {
  id: number;
  userId: number;
  recipientId: number;
  content: string;
  timestamp: string;
  type: 'dm';
  username: string;
  userRole: string;
}

interface MessageResponse {
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

// Store connected users
const connectedUsers = new Map<number, AuthenticatedSocket>();

// Track which room each user is currently in (null = global only)
const userCurrentRoom = new Map<number, number | null>();

// Track users in each room for presence
const roomUsers = new Map<number, Set<number>>();

function getRoomUserList(roomId: number): Array<{ userId: number; username: string; role: string }> {
  const userIds = roomUsers.get(roomId) || new Set();
  const users: Array<{ userId: number; username: string; role: string }> = [];

  for (const userId of userIds) {
    const socket = connectedUsers.get(userId);
    if (socket) {
      users.push({
        userId: socket.user.id,
        username: socket.user.username,
        role: socket.user.role,
      });
    }
  }

  return users;
}

export function setupSocketIO(httpServer: HTTPServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      (socket as AuthenticatedSocket).user = {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role,
      };
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return next(new Error('Token expired'));
      }
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const { user } = authSocket;

    console.log(`✓ User connected: ${user.username} (ID: ${user.id})`);

    // Store connected user
    connectedUsers.set(user.id, authSocket);

    // Join global room
    authSocket.join('global');

    // Broadcast user joined
    io.to('global').emit('user_joined', {
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // Handle send message
    authSocket.on('send_message', (payload: SendMessagePayload, callback) => {
      try {
        const { content, type = 'global', roomId } = payload;

        if (!content || content.trim() === '') {
          return callback?.({ error: 'Message content is required' });
        }

        if (content.length > 2000) {
          return callback?.({ error: 'Message too long (max 2000 characters)' });
        }

        // Check for dice roll command
        const diceNotation = extractDiceCommand(content.trim());
        let rollResult: DiceRollResult | null = null;
        let messageContent = content.trim();
        let messageType: string = type;

        if (diceNotation) {
          rollResult = parseAndRoll(diceNotation);
          if (rollResult) {
            // Format the roll result as human-readable content
            messageContent = formatRollResult(rollResult);
            messageType = 'roll';
          }
        }

        const queries = getMessageQueries();

        // Insert message into database
        const result = queries.create.run(
          type === 'room' ? roomId : null, // Use original type for room context
          user.id,
          messageContent,
          messageType,
          null, // recipient_id (for DMs)
          rollResult ? JSON.stringify(rollResult) : null // roll_result
        );

        // Get the created message with user info
        const message = queries.getById.get(result.lastInsertRowid) as {
          id: number;
          room_id: number | null;
          user_id: number;
          content: string;
          timestamp: string;
          type: string;
          username: string;
          user_role: string;
          roll_result: string | null;
        };

        const messageResponse: MessageResponse = {
          id: message.id,
          roomId: message.room_id,
          userId: message.user_id,
          content: message.content,
          timestamp: message.timestamp,
          type: message.type,
          username: message.username,
          userRole: message.user_role,
          rollResult: message.roll_result ? JSON.parse(message.roll_result) : undefined,
        };

        // Broadcast to appropriate room
        if (type === 'global') {
          io.to('global').emit('new_message', messageResponse);
        } else if (type === 'room' && roomId) {
          io.to(`room:${roomId}`).emit('new_message', messageResponse);
        }

        callback?.({ success: true, message: messageResponse });
      } catch (error) {
        console.error('Error sending message:', error);
        callback?.({ error: 'Failed to send message' });
      }
    });

    // Handle get message history
    authSocket.on('get_messages', (payload: { type?: 'global' | 'room'; roomId?: number; limit?: number }, callback) => {
      try {
        const { type = 'global', roomId, limit = 50 } = payload;
        const queries = getMessageQueries();

        let messages: Array<{
          id: number;
          room_id: number | null;
          user_id: number;
          content: string;
          timestamp: string;
          type: string;
          username: string;
          user_role: string;
          roll_result: string | null;
        }>;

        if (type === 'global') {
          messages = queries.getGlobalMessages.all(Math.min(limit, 100)) as typeof messages;
        } else if (type === 'room' && roomId) {
          messages = queries.getRoomMessages.all(roomId, Math.min(limit, 100)) as typeof messages;
        } else {
          return callback?.({ error: 'Invalid request' });
        }

        // Transform and reverse to get chronological order (oldest first)
        const transformedMessages: MessageResponse[] = messages
          .map((m) => ({
            id: m.id,
            roomId: m.room_id,
            userId: m.user_id,
            content: m.content,
            timestamp: m.timestamp,
            type: m.type,
            username: m.username,
            userRole: m.user_role,
            rollResult: m.roll_result ? JSON.parse(m.roll_result) : undefined,
          }))
          .reverse();

        callback?.({ success: true, messages: transformedMessages });
      } catch (error) {
        console.error('Error getting messages:', error);
        callback?.({ error: 'Failed to get messages' });
      }
    });

    // Handle typing indicator
    authSocket.on('typing_start', (payload?: { roomId?: number }) => {
      const roomId = payload?.roomId;
      const targetRoom = roomId ? `room:${roomId}` : 'global';
      authSocket.to(targetRoom).emit('user_typing', {
        userId: user.id,
        username: user.username,
        roomId: roomId || null,
      });
    });

    authSocket.on('typing_stop', (payload?: { roomId?: number }) => {
      const roomId = payload?.roomId;
      const targetRoom = roomId ? `room:${roomId}` : 'global';
      authSocket.to(targetRoom).emit('user_stopped_typing', {
        userId: user.id,
        roomId: roomId || null,
      });
    });

    // Handle join room
    authSocket.on('join_room', (payload: { roomId: number }, callback) => {
      try {
        const { roomId } = payload;

        if (!roomId || typeof roomId !== 'number') {
          return callback?.({ error: 'Invalid room ID' });
        }

        // Leave current room if in one
        const currentRoomId = userCurrentRoom.get(user.id);
        if (currentRoomId !== null && currentRoomId !== undefined) {
          authSocket.leave(`room:${currentRoomId}`);

          // Remove from room users tracking
          const currentRoomUsers = roomUsers.get(currentRoomId);
          if (currentRoomUsers) {
            currentRoomUsers.delete(user.id);
            if (currentRoomUsers.size === 0) {
              roomUsers.delete(currentRoomId);
            }
          }

          // Notify others in the old room
          io.to(`room:${currentRoomId}`).emit('user_left_room', {
            userId: user.id,
            username: user.username,
            roomId: currentRoomId,
          });
        }

        // Join new room
        authSocket.join(`room:${roomId}`);
        userCurrentRoom.set(user.id, roomId);

        // Add to room users tracking
        if (!roomUsers.has(roomId)) {
          roomUsers.set(roomId, new Set());
        }
        roomUsers.get(roomId)!.add(user.id);

        // Notify others in the new room
        io.to(`room:${roomId}`).emit('user_joined_room', {
          userId: user.id,
          username: user.username,
          role: user.role,
          roomId,
        });

        // Return success with room users
        callback?.({
          success: true,
          roomId,
          users: getRoomUserList(roomId),
        });
      } catch (error) {
        console.error('Error joining room:', error);
        callback?.({ error: 'Failed to join room' });
      }
    });

    // Handle leave room (go back to global only)
    authSocket.on('leave_room', (callback) => {
      try {
        const currentRoomId = userCurrentRoom.get(user.id);

        if (currentRoomId !== null && currentRoomId !== undefined) {
          authSocket.leave(`room:${currentRoomId}`);

          // Remove from room users tracking
          const currentRoomUsers = roomUsers.get(currentRoomId);
          if (currentRoomUsers) {
            currentRoomUsers.delete(user.id);
            if (currentRoomUsers.size === 0) {
              roomUsers.delete(currentRoomId);
            }
          }

          // Notify others in the room
          io.to(`room:${currentRoomId}`).emit('user_left_room', {
            userId: user.id,
            username: user.username,
            roomId: currentRoomId,
          });

          userCurrentRoom.set(user.id, null);
        }

        callback?.({ success: true });
      } catch (error) {
        console.error('Error leaving room:', error);
        callback?.({ error: 'Failed to leave room' });
      }
    });

    // Get room users
    authSocket.on('get_room_users', (payload: { roomId: number }, callback) => {
      try {
        const { roomId } = payload;

        if (!roomId || typeof roomId !== 'number') {
          return callback?.({ error: 'Invalid room ID' });
        }

        callback?.({
          success: true,
          users: getRoomUserList(roomId),
        });
      } catch (error) {
        console.error('Error getting room users:', error);
        callback?.({ error: 'Failed to get room users' });
      }
    });

    // Handle send DM
    authSocket.on('send_dm', (payload: SendDMPayload, callback) => {
      try {
        const { recipientId, content } = payload;

        if (!recipientId || typeof recipientId !== 'number') {
          return callback?.({ error: 'Invalid recipient ID' });
        }

        if (recipientId === user.id) {
          return callback?.({ error: 'Cannot send DM to yourself' });
        }

        if (!content || content.trim() === '') {
          return callback?.({ error: 'Message content is required' });
        }

        if (content.length > 2000) {
          return callback?.({ error: 'Message too long (max 2000 characters)' });
        }

        // Check if recipient exists
        const userQueries = getUserQueries();
        const recipient = userQueries.getById.get(recipientId) as { id: number; username: string; role: string } | undefined;

        if (!recipient) {
          return callback?.({ error: 'User not found' });
        }

        // Create/update conversation
        const conversationQueries = getConversationQueries();
        const conversation = conversationQueries.getOrCreate(user.id, recipientId);

        // Create DM message
        const dmQueries = getDMQueries();
        const result = dmQueries.create.run(user.id, content.trim(), recipientId);

        // Update conversation timestamp
        conversationQueries.updateLastMessage.run(conversation.id);

        // Mark as read for sender
        dmQueries.markRead.run(conversation.id, user.id);

        const dmMessage: DMMessageResponse = {
          id: result.lastInsertRowid as number,
          userId: user.id,
          recipientId,
          content: content.trim(),
          timestamp: new Date().toISOString(),
          type: 'dm',
          username: user.username,
          userRole: user.role,
        };

        // Send to recipient if online
        const recipientSocket = connectedUsers.get(recipientId);
        if (recipientSocket) {
          recipientSocket.emit('new_dm', dmMessage);
        }

        // Also send back to sender for confirmation
        authSocket.emit('new_dm', dmMessage);

        callback?.({ success: true, message: dmMessage });
      } catch (error) {
        console.error('Error sending DM:', error);
        callback?.({ error: 'Failed to send DM' });
      }
    });

    // Handle DM typing indicator
    authSocket.on('dm_typing_start', (payload: { recipientId: number }) => {
      const { recipientId } = payload;
      const recipientSocket = connectedUsers.get(recipientId);
      if (recipientSocket) {
        recipientSocket.emit('dm_user_typing', {
          userId: user.id,
          username: user.username,
        });
      }
    });

    authSocket.on('dm_typing_stop', (payload: { recipientId: number }) => {
      const { recipientId } = payload;
      const recipientSocket = connectedUsers.get(recipientId);
      if (recipientSocket) {
        recipientSocket.emit('dm_user_stopped_typing', {
          userId: user.id,
        });
      }
    });

    // Handle disconnect
    authSocket.on('disconnect', () => {
      console.log(`✗ User disconnected: ${user.username} (ID: ${user.id})`);

      // Clean up room membership
      const currentRoomId = userCurrentRoom.get(user.id);
      if (currentRoomId !== null && currentRoomId !== undefined) {
        const currentRoomUsers = roomUsers.get(currentRoomId);
        if (currentRoomUsers) {
          currentRoomUsers.delete(user.id);
          if (currentRoomUsers.size === 0) {
            roomUsers.delete(currentRoomId);
          }
        }

        // Notify others in the room
        io.to(`room:${currentRoomId}`).emit('user_left_room', {
          userId: user.id,
          username: user.username,
          roomId: currentRoomId,
        });
      }

      userCurrentRoom.delete(user.id);
      connectedUsers.delete(user.id);

      io.to('global').emit('user_left', {
        userId: user.id,
        username: user.username,
      });
    });
  });

  return io;
}

export function getConnectedUsers(): Map<number, AuthenticatedSocket> {
  return connectedUsers;
}
