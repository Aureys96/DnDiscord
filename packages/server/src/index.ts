import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeDatabase } from './db/index.js';
import { healthRoutes } from './routes/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env') });

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0';

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  },
});

// Register CORS
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
});

// Initialize database
try {
  initializeDatabase();
  fastify.log.info('✓ Database initialized');
} catch (error) {
  fastify.log.error('Failed to initialize database:', error);
  process.exit(1);
}

// Register routes
await fastify.register(healthRoutes);

// Start server
try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`🚀 Server listening on http://${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
