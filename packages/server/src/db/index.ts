import Database, { type Database as DatabaseType, type Statement } from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: DatabaseType;

export function getDatabase(): DatabaseType {
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
    // Hash password with bcrypt (synchronous for initialization)
    const passwordHash = bcrypt.hashSync('admin123', 10);

    database.prepare(`
      INSERT INTO users (username, password_hash, role)
      VALUES (?, ?, ?)
    `).run('admin', passwordHash, 'dm');

    console.log('✓ Created default DM user: admin / admin123');
  }
}

// User queries
export function getUserQueries(): {
  getByUsername: Statement;
  getById: Statement;
  create: Statement;
} {
  const database = getDatabase();
  return {
    getByUsername: database.prepare('SELECT * FROM users WHERE username = ?'),
    getById: database.prepare('SELECT * FROM users WHERE id = ?'),
    create: database.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'),
  };
}

// Message queries
export function getMessageQueries(): {
  create: Statement;
  getGlobalMessages: Statement;
  getRoomMessages: Statement;
  getById: Statement;
} {
  const database = getDatabase();
  return {
    create: database.prepare(`
      INSERT INTO messages (room_id, user_id, content, type, recipient_id, roll_result)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    getGlobalMessages: database.prepare(`
      SELECT m.id, m.room_id, m.user_id, m.content, m.timestamp, m.type, m.recipient_id, m.roll_result,
             u.username, u.role as user_role
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.type = 'global'
      ORDER BY m.timestamp DESC
      LIMIT ?
    `),
    getRoomMessages: database.prepare(`
      SELECT m.id, m.room_id, m.user_id, m.content, m.timestamp, m.type, m.recipient_id, m.roll_result,
             u.username, u.role as user_role
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.room_id = ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `),
    getById: database.prepare(`
      SELECT m.id, m.room_id, m.user_id, m.content, m.timestamp, m.type, m.recipient_id, m.roll_result,
             u.username, u.role as user_role
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `),
  };
}

// Room queries
export function getRoomQueries(): {
  create: Statement;
  getAll: Statement;
  getById: Statement;
  getByCreator: Statement;
  delete: Statement;
  update: Statement;
} {
  const database = getDatabase();
  return {
    create: database.prepare(`
      INSERT INTO rooms (name, created_by)
      VALUES (?, ?)
    `),
    getAll: database.prepare(`
      SELECT r.id, r.name, r.created_by, r.created_at, u.username as creator_username
      FROM rooms r
      JOIN users u ON r.created_by = u.id
      ORDER BY r.created_at DESC
    `),
    getById: database.prepare(`
      SELECT r.id, r.name, r.created_by, r.created_at, u.username as creator_username
      FROM rooms r
      JOIN users u ON r.created_by = u.id
      WHERE r.id = ?
    `),
    getByCreator: database.prepare(`
      SELECT r.id, r.name, r.created_by, r.created_at, u.username as creator_username
      FROM rooms r
      JOIN users u ON r.created_by = u.id
      WHERE r.created_by = ?
      ORDER BY r.created_at DESC
    `),
    delete: database.prepare('DELETE FROM rooms WHERE id = ?'),
    update: database.prepare('UPDATE rooms SET name = ? WHERE id = ?'),
  };
}

// Export database for use in routes
export { getDatabase as default };
