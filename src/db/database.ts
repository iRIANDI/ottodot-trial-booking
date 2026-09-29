import Database from 'better-sqlite3';
import path from 'path';

let dbInstance: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (dbInstance && !dbPath) {
    return dbInstance;
  }

  const resolvedPath = dbPath || path.resolve(process.cwd(), 'ottodot_trial.sqlite');
  const db = new Database(resolvedPath);

  // Enable WAL mode for high concurrency & Foreign Keys for relational integrity
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000'); // 5-second wait if locked

  initSchema(db);

  if (!dbPath) {
    dbInstance = db;
  }
  return db;
}

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trial_classes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 4,
      confirmed_count INTEGER NOT NULL DEFAULT 0 CHECK (confirmed_count <= capacity),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      trial_class_id TEXT NOT NULL REFERENCES trial_classes(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending_payment', 'confirmed', 'payment_failed', 'rejected_class_full')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_attempts (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
      idempotency_key TEXT NOT NULL UNIQUE,
      failure_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- CRITICAL PARTIAL UNIQUE INDEX:
    -- Guarantees at the database engine level that the SAME child cannot have more than ONE confirmed booking for the same trial class!
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_confirmed_child_booking
    ON bookings (trial_class_id, student_id)
    WHERE status = 'confirmed';

    -- Index for fast roster queries
    CREATE INDEX IF NOT EXISTS idx_bookings_class_status 
    ON bookings (trial_class_id, status);
  `);
}
