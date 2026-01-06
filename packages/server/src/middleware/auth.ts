import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { getUserQueries } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-please-change-in-production';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number;
      username: string;
      role: 'dm' | 'player';
    };
  }
}

interface JWTPayload {
  userId: number;
  username: string;
  role: 'dm' | 'player';
}

/**
 * Middleware to authenticate JWT tokens
 * Extracts token from Authorization header, verifies it, and attaches user to request
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Attach user to request
    request.user = {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };
  } catch (error) {
    // Check TokenExpiredError first since it extends JsonWebTokenError
    if (error instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
}

/**
 * Middleware to require DM role
 * Must be used after authenticate middleware
 */
export async function requireDM(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({ error: 'Not authenticated' });
  }

  if (request.user.role !== 'dm') {
    return reply.status(403).send({ error: 'Forbidden: DM role required' });
  }
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(userId: number, username: string, role: 'dm' | 'player'): string {
  const payload: JWTPayload = {
    userId,
    username,
    role,
  };

  // Token expires in 24 hours
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
