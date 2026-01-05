import { FastifyInstance } from 'fastify';
import { getUserQueries } from '../db/index.js';
import { HealthResponseSchema } from '@dnd-voice/shared';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/api/health', async (request, reply) => {
    try {
      const userQueries = getUserQueries();
      const dmUser = userQueries.getByUsername.get('admin') as { username: string } | undefined;

      const response = {
        status: 'ok',
        dmUser: dmUser?.username || 'unknown',
      };

      // Validate response with Zod schema
      const validated = HealthResponseSchema.parse(response);

      return reply.send(validated);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
