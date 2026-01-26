import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load env vars before creating pool
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Initialize database tables
export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        display_name TEXT,
        subscription_tier TEXT DEFAULT 'free',
        monthly_usage INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        original_text TEXT NOT NULL,
        enhanced_text TEXT,
        tone TEXT DEFAULT 'professional',
        detected_intent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
      CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
    `);
    console.log('Database tables initialized');
  } finally {
    client.release();
  }
}

export interface DBUser {
  id: string;
  email: string;
  display_name: string | null;
  subscription_tier: string;
  monthly_usage: number;
  created_at: string;
}

export interface DBNote {
  id: string;
  user_id: string;
  original_text: string;
  enhanced_text: string | null;
  tone: string;
  detected_intent: string | null;
  created_at: string;
}

// User operations
export async function findUserByEmail(email: string): Promise<DBUser | undefined> {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

export async function findUserById(id: string): Promise<DBUser | undefined> {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

export async function createUser(user: { id: string; email: string; displayName?: string }): Promise<DBUser> {
  const result = await pool.query(
    'INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3) RETURNING *',
    [user.id, user.email, user.displayName || null]
  );
  return result.rows[0];
}

export async function updateUser(
  id: string,
  updates: Partial<{ display_name: string; subscription_tier: string; monthly_usage: number }>
): Promise<void> {
  const fields = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  await pool.query(`UPDATE users SET ${setClause} WHERE id = $1`, [id, ...values]);
}

// Note operations
export async function createNote(note: {
  id: string;
  userId: string;
  originalText: string;
  enhancedText?: string;
  tone?: string;
  detectedIntent?: string;
}): Promise<DBNote> {
  const result = await pool.query(
    'INSERT INTO notes (id, user_id, original_text, enhanced_text, tone, detected_intent) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [
      note.id,
      note.userId,
      note.originalText,
      note.enhancedText || null,
      note.tone || 'professional',
      note.detectedIntent || null,
    ]
  );
  return result.rows[0];
}

export async function getUserNotes(userId: string, limit = 50, offset = 0): Promise<DBNote[]> {
  const result = await pool.query(
    'SELECT * FROM notes WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [userId, limit, offset]
  );
  return result.rows;
}

export async function getNoteById(id: string, userId: string): Promise<DBNote | undefined> {
  const result = await pool.query('SELECT * FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
  return result.rows[0];
}

export async function deleteNote(id: string, userId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
  return (result.rowCount ?? 0) > 0;
}

export async function updateNote(
  id: string,
  userId: string,
  updates: { enhancedText?: string; originalText?: string }
): Promise<DBNote | null> {
  const fields: string[] = [];
  const values: (string | null)[] = [];
  let paramIndex = 3;

  if (updates.enhancedText !== undefined) {
    fields.push(`enhanced_text = $${paramIndex++}`);
    values.push(updates.enhancedText);
  }
  if (updates.originalText !== undefined) {
    fields.push(`original_text = $${paramIndex++}`);
    values.push(updates.originalText);
  }

  if (fields.length === 0) {
    return null;
  }

  const result = await pool.query(
    `UPDATE notes SET ${fields.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId, ...values]
  );
  return result.rows[0] || null;
}

export async function countUserNotes(userId: string): Promise<number> {
  const result = await pool.query('SELECT COUNT(*) as count FROM notes WHERE user_id = $1', [userId]);
  return parseInt(result.rows[0].count, 10);
}
