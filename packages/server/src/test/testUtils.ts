import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create an in-memory test database
 */
export function createTestDatabase(): Database.Database {
  const db = new Database(":memory:");

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Load and execute schema
  const schema = readFileSync(join(__dirname, "../db/schema.sql"), "utf-8");
  db.exec(schema);

  // Seed default DM user
  const passwordHash = bcrypt.hashSync("admin123", 10);
  db.prepare(
    `
    INSERT INTO users (username, password_hash, role)
    VALUES (?, ?, ?)
  `,
  ).run("admin", passwordHash, "dm");

  return db;
}

/**
 * Create a test Fastify server with routes registered
 */
export async function createTestServer(
  db: Database.Database,
): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // Disable logging in tests
  });

  // Register CORS
  await fastify.register(cors, {
    origin: "http://localhost:5173",
    credentials: true,
  });

  // Inject test database into routes by mocking the db module
  // We'll do this by passing the db as a decorator
  fastify.decorate("db", db);

  return fastify;
}

/**
 * Clean up test database
 */
export function closeTestDatabase(db: Database.Database): void {
  db.close();
}
