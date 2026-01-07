import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import { authenticate, generateToken, requireDM } from './auth.js';
import jwt from 'jsonwebtoken';
import { initializeDatabase } from '../db/index.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Auth Middleware', () => {
  let fastify: FastifyInstance;
  const testDbPath = join(tmpdir(), 'test-middleware.db');

  beforeAll(async () => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Set up test database path
    process.env.DATABASE_PATH = testDbPath;

    // Initialize test database
    initializeDatabase();

    // Initialize Fastify server with test routes
    fastify = Fastify({ logger: false });

    // Test route that uses authenticate middleware
    fastify.get('/protected', { preHandler: authenticate }, async (request, reply) => {
      return reply.send({
        message: 'Protected route accessed',
        user: request.user,
      });
    });

    // Test route that uses both authenticate and requireDM
    fastify.get(
      '/dm-only',
      { preHandler: [authenticate, requireDM] },
      async (request, reply) => {
        return reply.send({
          message: 'DM-only route accessed',
          user: request.user,
        });
      }
    );

    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();

    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(1, 'testuser', 'player');

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts separated by dots

      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBe(1);
      expect(decoded.username).toBe('testuser');
      expect(decoded.role).toBe('player');
    });

    it('should generate different tokens for different users', () => {
      const token1 = generateToken(1, 'user1', 'player');
      const token2 = generateToken(2, 'user2', 'dm');

      expect(token1).not.toBe(token2);

      const decoded1 = jwt.verify(token1, process.env.JWT_SECRET!) as any;
      const decoded2 = jwt.verify(token2, process.env.JWT_SECRET!) as any;

      expect(decoded1.userId).toBe(1);
      expect(decoded2.userId).toBe(2);
      expect(decoded1.role).toBe('player');
      expect(decoded2.role).toBe('dm');
    });

    it('should include expiration time', () => {
      const token = generateToken(1, 'testuser', 'player');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iat');

      // Token should expire in approximately 24 hours (86400 seconds)
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(86400);
    });

    it('should work for both player and dm roles', () => {
      const playerToken = generateToken(1, 'player1', 'player');
      const dmToken = generateToken(2, 'dm1', 'dm');

      const decodedPlayer = jwt.verify(playerToken, process.env.JWT_SECRET!) as any;
      const decodedDM = jwt.verify(dmToken, process.env.JWT_SECRET!) as any;

      expect(decodedPlayer.role).toBe('player');
      expect(decodedDM.role).toBe('dm');
    });
  });

  describe('authenticate middleware', () => {
    it('should allow access with valid token', async () => {
      const token = generateToken(1, 'testuser', 'player');

      const response = await fastify.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('Protected route accessed');
      expect(body.user.id).toBe(1);
      expect(body.user.username).toBe('testuser');
      expect(body.user.role).toBe('player');
    });

    it('should reject request without authorization header', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/protected',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe('Missing or invalid authorization header');
    });

    it('should reject request with malformed authorization header', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'NotBearer token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe('Missing or invalid authorization header');
    });

    it('should reject request with invalid token', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer invalid.token.here',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe('Invalid token');
    });

    it('should reject token signed with different secret', async () => {
      const fakeToken = jwt.sign(
        { userId: 1, username: 'hacker', role: 'player' },
        'wrong-secret',
        { expiresIn: '24h' }
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${fakeToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe('Invalid token');
    });

    it('should reject expired token', async () => {
      // Create a token that expires immediately
      const expiredToken = jwt.sign(
        { userId: 1, username: 'testuser', role: 'player' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1s' } // Already expired
      );

      const response = await fastify.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe('Token expired');
    });
  });

  describe('requireDM middleware', () => {
    it('should allow DM users to access DM-only routes', async () => {
      const dmToken = generateToken(1, 'dmuser', 'dm');

      const response = await fastify.inject({
        method: 'GET',
        url: '/dm-only',
        headers: {
          authorization: `Bearer ${dmToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('DM-only route accessed');
      expect(body.user.role).toBe('dm');
    });

    it('should reject player users from DM-only routes', async () => {
      const playerToken = generateToken(2, 'playeruser', 'player');

      const response = await fastify.inject({
        method: 'GET',
        url: '/dm-only',
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('Forbidden: DM role required');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/dm-only',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe('Missing or invalid authorization header');
    });
  });
});
