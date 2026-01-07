import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { getUserQueries } from "../db/index.js";
import { authenticate, generateToken } from "../middleware/auth.js";
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  AuthResponseSchema,
  UserSchema,
} from "@dnd-voice/shared";

const SALT_ROUNDS = 10;

export async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/auth/register
   * Register a new user
   */
  fastify.post("/api/auth/register", async (request, reply) => {
    try {
      // Validate request body
      const body = RegisterRequestSchema.parse(request.body);

      const userQueries = getUserQueries();

      // Check if username already exists
      const existingUser = userQueries.getByUsername.get(body.username);
      if (existingUser) {
        return reply.status(409).send({ error: "Username already exists" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

      // Insert user
      const result = userQueries.create.run(
        body.username,
        passwordHash,
        body.role || "player",
      );
      const userId = result.lastInsertRowid as number;

      // Fetch created user
      const user = userQueries.getById.get(userId) as any;

      // Generate token
      const token = generateToken(user.id, user.username, user.role);

      // Prepare response
      const response = {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          createdAt: user.created_at,
        },
      };

      // Validate response
      const validated = AuthResponseSchema.parse(response);

      fastify.log.info(`User registered: ${user.username} (${user.role})`);

      return reply.status(201).send(validated);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return reply
          .status(400)
          .send({ error: "Invalid request data", details: error });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/auth/login
   * Login with username and password
   */
  fastify.post("/api/auth/login", async (request, reply) => {
    try {
      // Validate request body
      const body = LoginRequestSchema.parse(request.body);

      const userQueries = getUserQueries();

      // Find user
      const user = userQueries.getByUsername.get(body.username) as any;
      if (!user) {
        return reply
          .status(401)
          .send({ error: "Invalid username or password" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(
        body.password,
        user.password_hash,
      );
      if (!isValidPassword) {
        return reply
          .status(401)
          .send({ error: "Invalid username or password" });
      }

      // Generate token
      const token = generateToken(user.id, user.username, user.role);

      // Prepare response
      const response = {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          createdAt: user.created_at,
        },
      };

      // Validate response
      const validated = AuthResponseSchema.parse(response);

      fastify.log.info(`User logged in: ${user.username}`);

      return reply.send(validated);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return reply
          .status(400)
          .send({ error: "Invalid request data", details: error });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  /**
   * GET /api/auth/me
   * Get current user (protected route)
   */
  fastify.get(
    "/api/auth/me",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: "Not authenticated" });
        }

        const userQueries = getUserQueries();
        const user = userQueries.getById.get(request.user.id) as any;

        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }

        const response = {
          id: user.id,
          username: user.username,
          role: user.role,
          createdAt: user.created_at,
        };

        // Validate response
        const validated = UserSchema.parse(response);

        return reply.send(validated);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );
}
