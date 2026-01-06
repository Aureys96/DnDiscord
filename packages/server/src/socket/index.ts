import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getMessageQueries } from '../db/index.js';

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

interface MessageResponse {
  id: number;
  roomId: number | null;
  userId: number;
  content: string;
  timestamp: string;
  type: string;
  username: string;
  userRole: string;
}

// Store connected users
const connectedUsers = new Map<number, AuthenticatedSocket>();

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

        const queries = getMessageQueries();

        // Insert message into database
        const result = queries.create.run(
          type === 'room' ? roomId : null,
          user.id,
          content.trim(),
          type,
          null, // recipient_id (for DMs)
          null  // roll_result
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
          }))
          .reverse();

        callback?.({ success: true, messages: transformedMessages });
      } catch (error) {
        console.error('Error getting messages:', error);
        callback?.({ error: 'Failed to get messages' });
      }
    });

    // Handle typing indicator
    authSocket.on('typing_start', () => {
      authSocket.to('global').emit('user_typing', {
        userId: user.id,
        username: user.username,
      });
    });

    authSocket.on('typing_stop', () => {
      authSocket.to('global').emit('user_stopped_typing', {
        userId: user.id,
      });
    });

    // Handle disconnect
    authSocket.on('disconnect', () => {
      console.log(`✗ User disconnected: ${user.username} (ID: ${user.id})`);
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
