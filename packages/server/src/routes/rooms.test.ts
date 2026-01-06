import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './auth.js';
import { roomRoutes } from './rooms.js';
import { initializeDatabase, getDatabase } from '../db/index.js';
import { unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Room Routes', () => {
  let fastify: FastifyInstance;
  let dmToken: string;
  let playerToken: string;
  let dmUserId: number;
  let playerUserId: number;
  const testDbPath = join(__dirname, '../../test-rooms.db');

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
    await fastify.register(roomRoutes);
    await fastify.ready();

    // Create a DM user and get token
    const dmResponse = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testdm',
        password: 'password123',
        role: 'dm',
      },
    });
    const dmBody = dmResponse.json();
    dmToken = dmBody.token;
    dmUserId = dmBody.user.id;

    // Create a player user and get token
    const playerResponse = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'testplayer',
        password: 'password123',
        role: 'player',
      },
    });
    const playerBody = playerResponse.json();
    playerToken = playerBody.token;
    playerUserId = playerBody.user.id;
  });

  afterAll(async () => {
    await fastify.close();

    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  beforeEach(() => {
    // Clean up rooms between tests
    const db = getDatabase();
    db.prepare('DELETE FROM messages WHERE room_id IS NOT NULL').run();
    db.prepare('DELETE FROM rooms').run();
  });

  describe('POST /api/rooms (Create Room)', () => {
    it('should allow DM to create a room', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: {
          authorization: `Bearer ${dmToken}`,
        },
        payload: {
          name: 'Test Room',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty('room');
      expect(body.room.name).toBe('Test Room');
      expect(body.room.createdBy).toBe(dmUserId);
      expect(body.room).toHaveProperty('id');
      expect(body.room).toHaveProperty('createdAt');
    });

    it('should reject room creation from player', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
        payload: {
          name: 'Player Room',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('Forbidden: DM role required');
    });

    it('should reject room creation without authentication', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        payload: {
          name: 'Unauthenticated Room',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate room name is required', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: {
          authorization: `Bearer ${dmToken}`,
        },
        payload: {
          name: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('Validation failed');
    });

    it('should validate room name max length', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: {
          authorization: `Bearer ${dmToken}`,
        },
        payload: {
          name: 'a'.repeat(51), // 51 characters, max is 50
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/rooms (List Rooms)', () => {
    it('should return empty array when no rooms exist', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/rooms',
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('rooms');
      expect(body.rooms).toEqual([]);
    });

    it('should return all rooms', async () => {
      // Create some rooms first
      await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${dmToken}` },
        payload: { name: 'Room 1' },
      });
      await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${dmToken}` },
        payload: { name: 'Room 2' },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/rooms',
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.rooms).toHaveLength(2);
      expect(body.rooms[0]).toHaveProperty('creatorUsername');
    });

    it('should reject request without authentication', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/rooms',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/rooms/:id (Get Single Room)', () => {
    it('should return a specific room', async () => {
      // Create a room first
      const createResponse = await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${dmToken}` },
        payload: { name: 'Specific Room' },
      });
      const roomId = createResponse.json().room.id;

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/rooms/${roomId}`,
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.room.name).toBe('Specific Room');
      expect(body.room.id).toBe(roomId);
    });

    it('should return 404 for non-existent room', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/rooms/99999',
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('Room not found');
    });

    it('should return 400 for invalid room ID', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/rooms/invalid',
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('Invalid room ID');
    });
  });

  describe('PUT /api/rooms/:id (Update Room)', () => {
    it('should allow creator to update room', async () => {
      // Create a room first
      const createResponse = await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${dmToken}` },
        payload: { name: 'Original Name' },
      });
      const roomId = createResponse.json().room.id;

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/rooms/${roomId}`,
        headers: {
          authorization: `Bearer ${dmToken}`,
        },
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.room.name).toBe('Updated Name');
    });

    it('should reject update from non-creator DM', async () => {
      // Create a room with first DM
      const createResponse = await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${dmToken}` },
        payload: { name: 'DM1 Room' },
      });
      const roomId = createResponse.json().room.id;

      // Create another DM
      const dm2Response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          username: 'testdm2',
          password: 'password123',
          role: 'dm',
        },
      });
      const dm2Token = dm2Response.json().token;

      // Try to update with different DM
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/rooms/${roomId}`,
        headers: {
          authorization: `Bearer ${dm2Token}`,
        },
        payload: {
          name: 'Hijacked Name',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('Only the room creator can update this room');
    });

    it('should reject update from player', async () => {
      // Create a room
      const createResponse = await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${dmToken}` },
        payload: { name: 'DM Room' },
      });
      const roomId = createResponse.json().room.id;

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/rooms/${roomId}`,
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
        payload: {
          name: 'Player Update',
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/rooms/:id (Delete Room)', () => {
    it('should allow creator to delete room', async () => {
      // Create a room first
      const createResponse = await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${dmToken}` },
        payload: { name: 'Room to Delete' },
      });
      const roomId = createResponse.json().room.id;

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/rooms/${roomId}`,
        headers: {
          authorization: `Bearer ${dmToken}`,
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify room is deleted
      const getResponse = await fastify.inject({
        method: 'GET',
        url: `/api/rooms/${roomId}`,
        headers: { authorization: `Bearer ${dmToken}` },
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should reject delete from non-creator', async () => {
      // Create a room
      const createResponse = await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${dmToken}` },
        payload: { name: 'Protected Room' },
      });
      const roomId = createResponse.json().room.id;

      // Create another DM
      const dm2Response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          username: 'testdm3',
          password: 'password123',
          role: 'dm',
        },
      });
      const dm2Token = dm2Response.json().token;

      // Try to delete with different DM
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/rooms/${roomId}`,
        headers: {
          authorization: `Bearer ${dm2Token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('Only the room creator can delete this room');
    });

    it('should reject delete from player', async () => {
      // Create a room
      const createResponse = await fastify.inject({
        method: 'POST',
        url: '/api/rooms',
        headers: { authorization: `Bearer ${dmToken}` },
        payload: { name: 'DM Only Room' },
      });
      const roomId = createResponse.json().room.id;

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/rooms/${roomId}`,
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent room', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/rooms/99999',
        headers: {
          authorization: `Bearer ${dmToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
