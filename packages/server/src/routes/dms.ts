import { type FastifyInstance } from 'fastify';
import { getConversationQueries, getDMQueries, getUserQueries, getAllUsersQuery } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { z } from 'zod';

// Database row types
interface ConversationRow {
  id: number;
  user1_id: number;
  user2_id: number;
  last_message_at: string;
  other_user_id: number;
  other_username: string;
  other_role: string;
  last_message: string | null;
  unread_count: number;
}

interface DMMessageRow {
  id: number;
  user_id: number;
  content: string;
  timestamp: string;
  type: string;
  recipient_id: number;
  username: string;
  user_role: string;
}

interface UserRow {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

export async function dmRoutes(fastify: FastifyInstance) {
  // Get all conversations for current user
  fastify.get('/api/dms/conversations', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user!;
    const conversationQueries = getConversationQueries();

    // Pass userId 9 times as the query needs it for multiple conditions
    const rows = conversationQueries.getUserConversations.all(
      user.id, user.id, user.id, // CASE WHEN conditions
      user.id, user.id, user.id, // Unread count conditions
      user.id, // last_read_at lookup
      user.id, user.id // WHERE conditions
    ) as ConversationRow[];

    const conversations = rows.map(row => ({
      id: row.id,
      user1Id: row.user1_id,
      user2Id: row.user2_id,
      lastMessageAt: row.last_message_at,
      otherUserId: row.other_user_id,
      otherUsername: row.other_username,
      otherRole: row.other_role,
      lastMessage: row.last_message,
      unreadCount: row.unread_count,
    }));

    return reply.send({ conversations });
  });

  // Get or create conversation with a user
  fastify.post<{ Params: { userId: string } }>('/api/dms/conversations/:userId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const currentUser = request.user!;
    const otherUserId = parseInt(request.params.userId, 10);

    if (isNaN(otherUserId)) {
      return reply.status(400).send({ error: 'Invalid user ID' });
    }

    if (otherUserId === currentUser.id) {
      return reply.status(400).send({ error: 'Cannot start conversation with yourself' });
    }

    // Check if other user exists
    const userQueries = getUserQueries();
    const otherUser = userQueries.getById.get(otherUserId) as UserRow | undefined;

    if (!otherUser) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const conversationQueries = getConversationQueries();
    const conversation = conversationQueries.getOrCreate(currentUser.id, otherUserId);

    // Get full conversation details
    const fullConversation = conversationQueries.getById.get(conversation.id) as {
      id: number;
      user1_id: number;
      user2_id: number;
      last_message_at: string;
      user1_username: string;
      user1_role: string;
      user2_username: string;
      user2_role: string;
    };

    const isUser1 = fullConversation.user1_id === currentUser.id;

    return reply.status(201).send({
      conversation: {
        id: fullConversation.id,
        user1Id: fullConversation.user1_id,
        user2Id: fullConversation.user2_id,
        lastMessageAt: fullConversation.last_message_at,
        otherUserId: isUser1 ? fullConversation.user2_id : fullConversation.user1_id,
        otherUsername: isUser1 ? fullConversation.user2_username : fullConversation.user1_username,
        otherRole: isUser1 ? fullConversation.user2_role : fullConversation.user1_role,
      },
    });
  });

  // Get messages in a conversation with another user
  fastify.get<{ Params: { userId: string }; Querystring: { limit?: string } }>('/api/dms/:userId/messages', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const currentUser = request.user!;
    const otherUserId = parseInt(request.params.userId, 10);

    if (isNaN(otherUserId)) {
      return reply.status(400).send({ error: 'Invalid user ID' });
    }

    // Parse limit from query
    const limitParam = request.query.limit;
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;

    const dmQueries = getDMQueries();
    const rows = dmQueries.getConversationMessages.all(
      currentUser.id, otherUserId,
      otherUserId, currentUser.id,
      limit
    ) as DMMessageRow[];

    const messages = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      content: row.content,
      timestamp: row.timestamp,
      type: row.type,
      recipientId: row.recipient_id,
      username: row.username,
      userRole: row.user_role,
    }));

    // Mark conversation as read
    const conversationQueries = getConversationQueries();
    const conversation = conversationQueries.getOrCreate(currentUser.id, otherUserId);
    dmQueries.markRead.run(conversation.id, currentUser.id);

    return reply.send({ messages: messages.reverse() }); // Return in chronological order
  });

  // Send a DM to another user
  fastify.post<{ Params: { userId: string } }>('/api/dms/:userId/messages', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const currentUser = request.user!;
    const recipientId = parseInt(request.params.userId, 10);

    if (isNaN(recipientId)) {
      return reply.status(400).send({ error: 'Invalid user ID' });
    }

    if (recipientId === currentUser.id) {
      return reply.status(400).send({ error: 'Cannot send DM to yourself' });
    }

    // Validate request body
    const bodySchema = z.object({
      content: z.string().min(1, 'Message content is required').max(2000, 'Message must be at most 2000 characters'),
    });

    const bodyResult = bodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: bodyResult.error.flatten().fieldErrors,
      });
    }

    // Check if recipient exists
    const userQueries = getUserQueries();
    const recipient = userQueries.getById.get(recipientId) as UserRow | undefined;

    if (!recipient) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Create/update conversation
    const conversationQueries = getConversationQueries();
    const conversation = conversationQueries.getOrCreate(currentUser.id, recipientId);

    // Create message
    const dmQueries = getDMQueries();
    const result = dmQueries.create.run(currentUser.id, bodyResult.data.content, recipientId);

    // Update conversation timestamp
    conversationQueries.updateLastMessage.run(conversation.id);

    // Mark as read for sender
    dmQueries.markRead.run(conversation.id, currentUser.id);

    const message = {
      id: result.lastInsertRowid as number,
      userId: currentUser.id,
      content: bodyResult.data.content,
      timestamp: new Date().toISOString(),
      type: 'dm' as const,
      recipientId,
      username: currentUser.username,
      userRole: currentUser.role,
    };

    return reply.status(201).send({ message });
  });

  // Mark conversation as read
  fastify.post<{ Params: { userId: string } }>('/api/dms/:userId/read', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const currentUser = request.user!;
    const otherUserId = parseInt(request.params.userId, 10);

    if (isNaN(otherUserId)) {
      return reply.status(400).send({ error: 'Invalid user ID' });
    }

    const conversationQueries = getConversationQueries();
    const dmQueries = getDMQueries();

    const conversation = conversationQueries.getOrCreate(currentUser.id, otherUserId);
    dmQueries.markRead.run(conversation.id, currentUser.id);

    return reply.send({ success: true });
  });

  // Get all users (for starting new conversations)
  fastify.get('/api/users', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const currentUser = request.user!;
    const getAllUsers = getAllUsersQuery();
    const rows = getAllUsers.all() as UserRow[];

    // Filter out current user
    const users = rows
      .filter(row => row.id !== currentUser.id)
      .map(row => ({
        id: row.id,
        username: row.username,
        role: row.role,
        createdAt: row.created_at,
      }));

    return reply.send({ users });
  });

  // Get total unread DM count for current user
  fastify.get('/api/dms/unread-count', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user!;
    const conversationQueries = getConversationQueries();

    // Get all conversations and sum unread counts
    const rows = conversationQueries.getUserConversations.all(
      user.id, user.id, user.id,
      user.id, user.id, user.id,
      user.id,
      user.id, user.id
    ) as ConversationRow[];

    const totalUnread = rows.reduce((sum, row) => sum + row.unread_count, 0);

    return reply.send({ unreadCount: totalUnread });
  });
}
