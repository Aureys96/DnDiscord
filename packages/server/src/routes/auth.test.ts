import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { authRoutes } from "./auth.js";
import { initializeDatabase, getDatabase } from "../db/index.js";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Auth Routes", () => {
  let fastify: FastifyInstance;
  const testDbPath = join(tmpdir(), "test-auth.db");

  beforeAll(async () => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Set up test database path
    process.env.DATABASE_PATH = testDbPath;
    process.env.JWT_SECRET = "test-secret-key";

    // Initialize test database with schema and admin user
    initializeDatabase();

    // Initialize Fastify server
    fastify = Fastify({ logger: false });
    await fastify.register(cors, {
      origin: "http://localhost:5173",
      credentials: true,
    });
    await fastify.register(authRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();

    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  beforeEach(() => {
    // Clean up test users between tests (except admin)
    const db = getDatabase();
    db.prepare("DELETE FROM users WHERE username != 'admin'").run();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          username: "testplayer",
          password: "password123",
          role: "player",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty("token");
      expect(body).toHaveProperty("user");
      expect(body.user.username).toBe("testplayer");
      expect(body.user.role).toBe("player");
      expect(body.user).toHaveProperty("id");
      expect(body.user).toHaveProperty("createdAt");
      expect(typeof body.token).toBe("string");
    });

    it("should default to player role if not specified", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          username: "defaultrole",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.user.role).toBe("player");
    });

    it("should reject duplicate username", async () => {
      // Register first user
      await fastify.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          username: "duplicate",
          password: "password123",
        },
      });

      // Try to register same username again
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          username: "duplicate",
          password: "different123",
        },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error).toBe("Username already exists");
    });

    it("should reject username that is too short", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          username: "ab",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe("Invalid request data");
    });

    it("should reject password that is too short", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          username: "testuser",
          password: "12345",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe("Invalid request data");
    });

    it("should reject missing username", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject missing password", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          username: "testuser",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      // First register a user
      await fastify.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          username: "logintest",
          password: "password123",
        },
      });

      // Now try to login
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          username: "logintest",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("token");
      expect(body).toHaveProperty("user");
      expect(body.user.username).toBe("logintest");
      expect(typeof body.token).toBe("string");
    });

    it("should login admin user with bcrypt password", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          username: "admin",
          password: "admin123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.username).toBe("admin");
      expect(body.user.role).toBe("dm");
    });

    it("should reject invalid username", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          username: "nonexistent",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe("Invalid username or password");
    });

    it("should reject invalid password", async () => {
      // Register a user
      await fastify.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          username: "wrongpassword",
          password: "correctpassword",
        },
      });

      // Try to login with wrong password
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          username: "wrongpassword",
          password: "wrongpassword",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe("Invalid username or password");
    });

    it("should reject username that is too short", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          username: "ab",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject password that is too short", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          username: "testuser",
          password: "12345",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/auth/me", () => {
    let validToken: string;
    let userId: number;

    beforeEach(async () => {
      // Register a user and get token
      const response = await fastify.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          username: "metest",
          password: "password123",
        },
      });

      const body = response.json();
      validToken = body.token;
      userId = body.user.id;
    });

    it("should return user data with valid token", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.username).toBe("metest");
      expect(body.role).toBe("player");
      expect(body.id).toBe(userId);
      expect(body).toHaveProperty("createdAt");
    });

    it("should reject request without authorization header", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/auth/me",
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe("Missing or invalid authorization header");
    });

    it("should reject request with invalid authorization format", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          authorization: "InvalidFormat",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe("Missing or invalid authorization header");
    });

    it("should reject request with invalid token", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          authorization: "Bearer invalid.token.here",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe("Invalid token");
    });

    it("should reject request with token signed with different secret", async () => {
      // This token is valid JWT but signed with different secret
      const fakeToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoidGVzdCIsInJvbGUiOiJwbGF5ZXIifQ.invalid_signature";

      const response = await fastify.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          authorization: `Bearer ${fakeToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe("Invalid token");
    });
  });
});
