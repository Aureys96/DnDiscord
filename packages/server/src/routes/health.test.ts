import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./health.js";
import { initializeDatabase } from "../db/index.js";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Health Routes", () => {
  let fastify: FastifyInstance;
  const testDbPath = join(tmpdir(), "test-health.db");

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
    await fastify.register(healthRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();

    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it("should return health status with admin user", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      dmUser: "admin",
    });
  });

  it("should return valid JSON response", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/api/health",
    });

    const body = response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("dmUser");
    expect(typeof body.status).toBe("string");
    expect(typeof body.dmUser).toBe("string");
  });
});
