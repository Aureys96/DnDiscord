import Database, {
  type Database as DatabaseType,
  type Statement,
} from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";
import bcrypt from "bcrypt";

let db: DatabaseType;

// Get the directory containing this file at runtime
function getSchemaPath(): string {
  // Check if SCHEMA_PATH is explicitly set
  if (process.env.SCHEMA_PATH) {
    return process.env.SCHEMA_PATH;
  }
  // Try multiple locations to support both running from project root and server package
  const possiblePaths = [
    join(process.cwd(), "packages/server/src/db/schema.sql"), // From project root
    join(process.cwd(), "src/db/schema.sql"), // From packages/server
  ];

  for (const schemaPath of possiblePaths) {
    try {
      readFileSync(schemaPath); // Check if file exists
      return schemaPath;
    } catch {
      continue;
    }
  }

  // Fallback to project root path (will error if not found)
  return possiblePaths[0];
}

function getDefaultDbPath(): string {
  // Try multiple locations
  const cwd = process.cwd();
  if (cwd.endsWith("packages/server")) {
    return join(cwd, "../../data/dnd.db");
  }
  return join(cwd, "data/dnd.db");
}

export function getDatabase(): DatabaseType {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || getDefaultDbPath();

    db = new Database(dbPath);

    // Enable foreign keys
    db.pragma("foreign_keys = ON");
  }

  return db;
}

// Initialize database schema
export function initializeDatabase() {
  const database = getDatabase();
  const schema = readFileSync(getSchemaPath(), "utf-8");
  database.exec(schema);

  // Seed default DM user if not exists
  const existingUser = database
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("admin");

  if (!existingUser) {
    // Hash password with bcrypt (synchronous for initialization)
    const passwordHash = bcrypt.hashSync("admin123", 10);

    database
      .prepare(
        `
      INSERT INTO users (username, password_hash, role)
      VALUES (?, ?, ?)
    `,
      )
      .run("admin", passwordHash, "dm");

    console.log("✓ Created default DM user: admin / admin123");
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
    getByUsername: database.prepare("SELECT * FROM users WHERE username = ?"),
    getById: database.prepare("SELECT * FROM users WHERE id = ?"),
    create: database.prepare(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
    ),
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
    delete: database.prepare("DELETE FROM rooms WHERE id = ?"),
    update: database.prepare("UPDATE rooms SET name = ? WHERE id = ?"),
  };
}

// Conversation queries (for DMs)
export function getConversationQueries(): {
  create: Statement;
  getOrCreate: (user1Id: number, user2Id: number) => { id: number };
  getById: Statement;
  getByUsers: Statement;
  getUserConversations: Statement;
  updateLastMessage: Statement;
  delete: Statement;
} {
  const database = getDatabase();

  const createStmt = database.prepare(`
    INSERT INTO conversations (user1_id, user2_id)
    VALUES (?, ?)
  `);

  const getByUsersStmt = database.prepare(`
    SELECT * FROM conversations
    WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
  `);

  return {
    create: createStmt,
    // Get existing conversation or create new one (always store smaller ID first for consistency)
    getOrCreate: (user1Id: number, user2Id: number) => {
      const [smallerId, largerId] =
        user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
      let conversation = getByUsersStmt.get(
        smallerId,
        largerId,
        largerId,
        smallerId,
      ) as { id: number } | undefined;

      if (!conversation) {
        const result = createStmt.run(smallerId, largerId);
        conversation = { id: result.lastInsertRowid as number };
      }

      return conversation;
    },
    getById: database.prepare(`
      SELECT c.*,
             u1.username as user1_username, u1.role as user1_role,
             u2.username as user2_username, u2.role as user2_role
      FROM conversations c
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      WHERE c.id = ?
    `),
    getByUsers: getByUsersStmt,
    // Get all conversations for a user with the other user's info and last message preview
    getUserConversations: database.prepare(`
      SELECT
        c.id,
        c.user1_id,
        c.user2_id,
        c.last_message_at,
        CASE WHEN c.user1_id = ? THEN u2.id ELSE u1.id END as other_user_id,
        CASE WHEN c.user1_id = ? THEN u2.username ELSE u1.username END as other_username,
        CASE WHEN c.user1_id = ? THEN u2.role ELSE u1.role END as other_role,
        (
          SELECT content FROM messages
          WHERE type = 'dm'
          AND ((user_id = c.user1_id AND recipient_id = c.user2_id)
               OR (user_id = c.user2_id AND recipient_id = c.user1_id))
          ORDER BY timestamp DESC LIMIT 1
        ) as last_message,
        (
          SELECT COUNT(*) FROM messages m
          WHERE m.type = 'dm'
          AND m.recipient_id = ?
          AND ((m.user_id = c.user1_id AND c.user2_id = ?) OR (m.user_id = c.user2_id AND c.user1_id = ?))
          AND m.timestamp > COALESCE(
            (SELECT last_read_at FROM conversation_reads WHERE conversation_id = c.id AND user_id = ?),
            '1970-01-01'
          )
        ) as unread_count
      FROM conversations c
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY c.last_message_at DESC
    `),
    updateLastMessage: database.prepare(`
      UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?
    `),
    delete: database.prepare("DELETE FROM conversations WHERE id = ?"),
  };
}

// DM message queries
export function getDMQueries(): {
  create: Statement;
  getConversationMessages: Statement;
  markRead: Statement;
  getUnreadCount: Statement;
} {
  const database = getDatabase();
  return {
    create: database.prepare(`
      INSERT INTO messages (room_id, user_id, content, type, recipient_id, roll_result)
      VALUES (NULL, ?, ?, 'dm', ?, NULL)
    `),
    getConversationMessages: database.prepare(`
      SELECT m.id, m.user_id, m.content, m.timestamp, m.type, m.recipient_id,
             u.username, u.role as user_role
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.type = 'dm'
      AND ((m.user_id = ? AND m.recipient_id = ?) OR (m.user_id = ? AND m.recipient_id = ?))
      ORDER BY m.timestamp DESC
      LIMIT ?
    `),
    markRead: database.prepare(`
      INSERT INTO conversation_reads (conversation_id, user_id, last_read_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(conversation_id, user_id)
      DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
    `),
    getUnreadCount: database.prepare(`
      SELECT COUNT(*) as count FROM messages m
      WHERE m.type = 'dm' AND m.recipient_id = ?
      AND m.timestamp > COALESCE(
        (SELECT MAX(last_read_at) FROM conversation_reads cr
         JOIN conversations c ON cr.conversation_id = c.id
         WHERE cr.user_id = ? AND (c.user1_id = m.user_id OR c.user2_id = m.user_id)),
        '1970-01-01'
      )
    `),
  };
}

// Get all users (for starting new DM conversations)
export function getAllUsersQuery(): Statement {
  const database = getDatabase();
  return database.prepare(`
    SELECT id, username, role, created_at FROM users ORDER BY username ASC
  `);
}

// Export database for use in routes
export { getDatabase as default };
