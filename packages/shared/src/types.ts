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
