import { z } from 'zod';

// User types
export const UserRoleSchema = z.enum(['dm', 'player']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  role: UserRoleSchema,
  createdAt: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

// Room types
export const RoomSchema = z.object({
  id: z.number(),
  name: z.string(),
  createdBy: z.number(),
  createdAt: z.string(),
});
export type Room = z.infer<typeof RoomSchema>;

// Message types
export const MessageTypeSchema = z.enum(['room', 'global', 'dm', 'roll']);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessageSchema = z.object({
  id: z.number(),
  roomId: z.number().nullable(),
  userId: z.number(),
  content: z.string(),
  timestamp: z.string(),
  type: MessageTypeSchema,
  recipientId: z.number().nullable().optional(),
  rollResult: z.object({
    rolls: z.array(z.number()),
    total: z.number(),
    formula: z.string(),
  }).optional(),
});
export type Message = z.infer<typeof MessageSchema>;

// Health check response
export const HealthResponseSchema = z.object({
  status: z.string(),
  dmUser: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// Authentication types
export const LoginRequestSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password must be at most 100 characters'),
  role: UserRoleSchema.optional().default('player'),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
