import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database.Database;

export function getDatabase() {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../../data/dnd.db');
    const dbFullPath = dbPath.startsWith('/') ? dbPath : join(__dirname, dbPath);

    db = new Database(dbFullPath);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');
  }

  return db;
}

// Initialize database schema
export function initializeDatabase() {
  const database = getDatabase();
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  database.exec(schema);

  // Seed default DM user if not exists
  const existingUser = database.prepare('SELECT id FROM users WHERE username = ?').get('admin');

  if (!existingUser) {
    // Simple hash for now (will use bcrypt in Milestone 2)
    const passwordHash = crypto.createHash('sha256').update('admin123').digest('hex');

    database.prepare(`
      INSERT INTO users (username, password_hash, role)
      VALUES (?, ?, ?)
    `).run('admin', passwordHash, 'dm');

    console.log('✓ Created default DM user: admin / admin123');
  }
}

// User queries
export function getUserQueries() {
  const database = getDatabase();
  return {
    getByUsername: database.prepare('SELECT * FROM users WHERE username = ?'),
    getById: database.prepare('SELECT * FROM users WHERE id = ?'),
    create: database.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'),
  };
}

// Export database for use in routes
export { getDatabase as default };
