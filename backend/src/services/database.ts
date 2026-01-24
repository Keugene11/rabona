import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '../../data/rabona.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    subscription_tier TEXT DEFAULT 'free',
    monthly_usage INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    original_text TEXT NOT NULL,
    enhanced_text TEXT,
    tone TEXT DEFAULT 'professional',
    detected_intent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
  CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
`);

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
export function findUserByEmail(email: string): DBUser | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as DBUser | undefined;
}

export function findUserById(id: string): DBUser | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DBUser | undefined;
}

export function createUser(user: { id: string; email: string; displayName?: string }): DBUser {
  const stmt = db.prepare(
    'INSERT INTO users (id, email, display_name) VALUES (?, ?, ?) RETURNING *'
  );
  return stmt.get(user.id, user.email, user.displayName || null) as DBUser;
}

export function updateUser(id: string, updates: Partial<{ display_name: string; subscription_tier: string; monthly_usage: number }>): void {
  const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE users SET ${fields} WHERE id = @id`);
  stmt.run({ ...updates, id });
}

// Note operations
export function createNote(note: {
  id: string;
  userId: string;
  originalText: string;
  enhancedText?: string;
  tone?: string;
  detectedIntent?: string;
}): DBNote {
  const stmt = db.prepare(
    'INSERT INTO notes (id, user_id, original_text, enhanced_text, tone, detected_intent) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  );
  return stmt.get(
    note.id,
    note.userId,
    note.originalText,
    note.enhancedText || null,
    note.tone || 'professional',
    note.detectedIntent || null
  ) as DBNote;
}

export function getUserNotes(userId: string, limit = 50, offset = 0): DBNote[] {
  return db.prepare(
    'SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(userId, limit, offset) as DBNote[];
}

export function getNoteById(id: string, userId: string): DBNote | undefined {
  return db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, userId) as DBNote | undefined;
}

export function deleteNote(id: string, userId: string): boolean {
  const result = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

export function countUserNotes(userId: string): number {
  const result = db.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?').get(userId) as { count: number };
  return result.count;
}

// Database instance is internal - use exported functions instead
