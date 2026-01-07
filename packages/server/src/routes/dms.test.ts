import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './auth.js';
import { dmRoutes } from './dms.js';
import { initializeDatabase, getDatabase } from '../db/index.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('DM Routes', () => {
  let fastify: FastifyInstance;
  let user1Token: string;
  let user2Token: string;
  let user1Id: number;
  let user2Id: number;
  let user3Token: string;
  let user3Id: number;
  const testDbPath = join(tmpdir(), 'test-dms.db');

  beforeAll(async () => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Set up test database path
    process.env.DATABASE_PATH = testDbPath;
    process.env.JWT_SECRET = 'test-secret-key';

    // Initialize test database with schema and admin user
    initializeDatabase();

    // Initialize Fastify server
    fastify = Fastify({ logger: false });
    await fastify.register(cors, { origin: 'http://localhost:5173', credentials: true });
    await fastify.register(authRoutes);
    await fastify.register(dmRoutes);
    await fastify.ready();

    // Create user1 (DM)
    const user1Response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'dmuser',
        password: 'password123',
        role: 'dm',
      },
    });
    const user1Body = user1Response.json();
    user1Token = user1Body.token;
    user1Id = user1Body.user.id;

    // Create user2 (Player)
    const user2Response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'player1',
        password: 'password123',
        role: 'player',
      },
    });
    const user2Body = user2Response.json();
    user2Token = user2Body.token;
    user2Id = user2Body.user.id;

    // Create user3 (Another Player)
    const user3Response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'player2',
        password: 'password123',
        role: 'player',
      },
    });
    const user3Body = user3Response.json();
    user3Token = user3Body.token;
    user3Id = user3Body.user.id;
  });

  afterAll(async () => {
    await fastify.close();

    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  beforeEach(() => {
    // Clean up DM-related data between tests
    const db = getDatabase();
    db.prepare("DELETE FROM messages WHERE type = 'dm'").run();
    db.prepare('DELETE FROM conversation_reads').run();
    db.prepare('DELETE FROM conversations').run();
  });

  describe('GET /api/users (List Users)', () => {
    it('should return all users except current user', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/users',
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('users');
      expect(body.users.length).toBeGreaterThanOrEqual(2);
      // Should not include current user
      expect(body.users.find((u: { id: number }) => u.id === user1Id)).toBeUndefined();
    });

    it('should reject request without authentication', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/users',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/dms/conversations/:userId (Start Conversation)', () => {
    it('should create a new conversation', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/api/dms/conversations/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty('conversation');
      expect(body.conversation.otherUserId).toBe(user2Id);
      expect(body.conversation.otherUsername).toBe('player1');
    });

    it('should return existing conversation if already exists', async () => {
      // Create conversation first
      const response1 = await fastify.inject({
        method: 'POST',
        url: `/api/dms/conversations/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });
      const conv1Id = response1.json().conversation.id;

      // Try to create again
      const response2 = await fastify.inject({
        method: 'POST',
        url: `/api/dms/conversations/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response2.statusCode).toBe(201);
      expect(response2.json().conversation.id).toBe(conv1Id);
    });

    it('should reject starting conversation with yourself', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/api/dms/conversations/${user1Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('Cannot start conversation with yourself');
    });

    it('should reject starting conversation with non-existent user', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/dms/conversations/99999',
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('User not found');
    });

    it('should reject invalid user ID', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/dms/conversations/invalid',
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('Invalid user ID');
    });
  });

  describe('GET /api/dms/conversations (List Conversations)', () => {
    it('should return empty array when no conversations exist', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/dms/conversations',
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.conversations).toEqual([]);
    });

    it('should return conversations with other user info', async () => {
      // Create a conversation first
      await fastify.inject({
        method: 'POST',
        url: `/api/dms/conversations/${user2Id}`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/dms/conversations',
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.conversations.length).toBe(1);
      expect(body.conversations[0].otherUsername).toBe('player1');
    });
  });

  describe('POST /api/dms/:userId/messages (Send DM)', () => {
    it('should send a DM message', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/api/dms/${user2Id}/messages`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
        payload: {
          content: 'Hello, player!',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.message.content).toBe('Hello, player!');
      expect(body.message.userId).toBe(user1Id);
      expect(body.message.recipientId).toBe(user2Id);
      expect(body.message.type).toBe('dm');
    });

    it('should reject empty message', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/api/dms/${user2Id}/messages`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
        payload: {
          content: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject message over 2000 characters', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/api/dms/${user2Id}/messages`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
        payload: {
          content: 'a'.repeat(2001),
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject sending DM to yourself', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: `/api/dms/${user1Id}/messages`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
        payload: {
          content: 'Hello, myself!',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('Cannot send DM to yourself');
    });

    it('should reject sending DM to non-existent user', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/dms/99999/messages',
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
        payload: {
          content: 'Hello!',
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('User not found');
    });
  });

  describe('GET /api/dms/:userId/messages (Get DM Messages)', () => {
    it('should return messages in conversation', async () => {
      // Send a message first
      await fastify.inject({
        method: 'POST',
        url: `/api/dms/${user2Id}/messages`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
        payload: {
          content: 'Hello!',
        },
      });

      // Reply from user2
      await fastify.inject({
        method: 'POST',
        url: `/api/dms/${user1Id}/messages`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
        payload: {
          content: 'Hi there!',
        },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/dms/${user2Id}/messages`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.messages.length).toBe(2);
      // Check both messages exist (order may vary based on timestamp precision)
      const contents = body.messages.map((m: { content: string }) => m.content);
      expect(contents).toContain('Hello!');
      expect(contents).toContain('Hi there!');
    });

    it('should return empty array for conversation with no messages', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/dms/${user2Id}/messages`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.messages).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      // Send multiple messages
      for (let i = 0; i < 5; i++) {
        await fastify.inject({
          method: 'POST',
          url: `/api/dms/${user2Id}/messages`,
          headers: {
            authorization: `Bearer ${user1Token}`,
          },
          payload: {
            content: `Message ${i}`,
          },
        });
      }

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/dms/${user2Id}/messages?limit=3`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.messages.length).toBe(3);
    });
  });

  describe('POST /api/dms/:userId/read (Mark as Read)', () => {
    it('should mark conversation as read', async () => {
      // Send a message from user2 to user1
      await fastify.inject({
        method: 'POST',
        url: `/api/dms/${user1Id}/messages`,
        headers: {
          authorization: `Bearer ${user2Token}`,
        },
        payload: {
          content: 'New message!',
        },
      });

      // Mark as read
      const response = await fastify.inject({
        method: 'POST',
        url: `/api/dms/${user2Id}/read`,
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().success).toBe(true);
    });
  });

  describe('GET /api/dms/unread-count (Total Unread Count)', () => {
    it('should return 0 when no unread messages', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/dms/unread-count',
        headers: {
          authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().unreadCount).toBe(0);
    });
  });
});
