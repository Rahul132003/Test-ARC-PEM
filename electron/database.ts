/**
 * Database initialisation and schema management.
 *
 * On startup:
 *  1. resolveDbPath() checks app-settings.json for a custom (shared) database path.
 *  2. If none, defaults to <userData>/budget-calculator.db.
 *  3. WAL mode is enabled for better read concurrency (shared-folder scenario).
 *  4. createTables() runs CREATE TABLE IF NOT EXISTS, then a migration loop that
 *     adds columns introduced in newer versions without touching existing data.
 */

import Database from 'better-sqlite3';
import path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

let db: Database.Database;
let _dbPath: string;

const SETTINGS_PATH = () => path.join(app.getPath('userData'), 'app-settings.json');

/**
 * Returns the database file path, preferring any custom path saved in app-settings.json.
 * Falls back to the default location inside <userData> if the settings file is absent,
 * unreadable, or points to a path that no longer exists.
 */
function resolveDbPath(): string {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH(), 'utf-8');
    const settings = JSON.parse(raw);
    if (settings.dbPath && fs.existsSync(settings.dbPath)) {
      return settings.dbPath;
    }
  } catch (_) {
    // File absent or malformed — use default path
  }
  return path.join(app.getPath('userData'), 'budget-calculator.db');
}

/** Initialises (or opens) the SQLite database and runs schema migrations. */
export function initDatabase(): void {
  _dbPath = resolveDbPath();
  db = new Database(_dbPath);

  db.pragma('journal_mode = WAL'); // Better concurrency for shared-folder usage
  db.pragma('foreign_keys = ON');

  createTables();
}

/** Returns the active database instance. Throws if called before initDatabase(). */
export function getDatabase(): InstanceType<typeof Database> {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

/** Returns the absolute path to the currently open database file. */
export function getCurrentDbPath(): string {
  return _dbPath;
}

/** Closes the database connection (call before replacing the file on restore). */
export function closeDatabase(): void {
  if (db) db.close();
}

/** Returns the path to the settings JSON file that stores the custom db path. */
export function getSettingsPath(): string {
  return SETTINGS_PATH();
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      client          TEXT NOT NULL,
      plot_no         TEXT,
      location        TEXT,
      area_sqft       REAL DEFAULT 0,
      description     TEXT,
      gst_rate        REAL DEFAULT 18,
      contingency_rate REAL DEFAULT 10,
      status          TEXT DEFAULT 'Active',
      tags            TEXT DEFAULT '[]',
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      color       TEXT DEFAULT '#6366f1',
      sort_order  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS line_items (
      id            TEXT PRIMARY KEY,
      category_id   TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      description   TEXT NOT NULL,
      unit          TEXT DEFAULT 'Lump Sum',
      quantity      REAL DEFAULT 1,
      rate          REAL DEFAULT 0,
      notes         TEXT,
      sort_order    INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS templates (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      data        TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      category       TEXT NOT NULL DEFAULT 'vendor',
      contact_person TEXT,
      phone          TEXT,
      email          TEXT,
      gstin          TEXT,
      notes          TEXT,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id              TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      expense_date    TEXT NOT NULL,
      category        TEXT NOT NULL,
      vendor_name     TEXT,
      description     TEXT,
      quantity        REAL,
      rate_unit       REAL,
      amount          REAL DEFAULT 0,
      advance_amt     REAL DEFAULT 0,
      cash_payment    REAL DEFAULT 0,
      cheque_payment  REAL DEFAULT 0,
      pending_payment REAL DEFAULT 0,
      cheque_no       TEXT,
      payment_date    TEXT,
      mason_count     REAL DEFAULT 0,
      mason_rate      REAL DEFAULT 0,
      coolie_count    REAL DEFAULT 0,
      coolie_rate     REAL DEFAULT 0,
      helper_count    REAL DEFAULT 0,
      helper_rate     REAL DEFAULT 0,
      other_count     REAL DEFAULT 0,
      other_rate      REAL DEFAULT 0,
      remarks         TEXT,
      sort_order      INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now')),
      has_gst         INTEGER DEFAULT 0,
      gst_rate        REAL DEFAULT 0,
      gst_amount      REAL DEFAULT 0,
      attachment_path TEXT,
      invoice_no      TEXT,
      unit            TEXT,
      round_off       INTEGER DEFAULT 0,
      round_off_amount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vendor_settlements (
      id              TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      vendor_name     TEXT NOT NULL,
      work_description TEXT,
      quantity        REAL,
      unit            TEXT,
      rate            REAL,
      settled_amount  REAL,
      use_settlement  INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(project_id, vendor_name)
    );

    CREATE TABLE IF NOT EXISTS recent_activity (
      id           TEXT PRIMARY KEY,
      type         TEXT NOT NULL,
      project_id   TEXT NOT NULL,
      project_name TEXT NOT NULL,
      client_name  TEXT NOT NULL DEFAULT '',
      sub_label    TEXT NOT NULL DEFAULT '',
      route        TEXT NOT NULL,
      accessed_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(type, project_id)
    );
  `);

  // ── Project-level column migrations ──────────────────────────────────────
  const projectMigrations = [
    { name: 'status', type: "TEXT DEFAULT 'Active'" },
    { name: 'tags',   type: "TEXT DEFAULT '[]'" },
  ];
  for (const col of projectMigrations) {
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN ${col.name} ${col.type}`);
    } catch (err: any) {
      if (!err?.message?.includes('duplicate column')) {
        console.error(`[db] Migration warning for projects.${col.name}:`, err?.message);
      }
    }
  }

  // ── Additive column migrations for existing databases ─────────────────────
  // Each entry adds a column that didn't exist in earlier versions.
  // "duplicate column" errors are silently ignored; anything else is logged.
  const migrateCols = [
    { name: 'quantity',        type: 'REAL' },
    { name: 'rate_unit',       type: 'REAL' },
    { name: 'cheque_no',       type: 'TEXT' },
    { name: 'payment_date',    type: 'TEXT' },
    { name: 'mason_count',     type: 'REAL DEFAULT 0' },
    { name: 'mason_rate',      type: 'REAL DEFAULT 0' },
    { name: 'coolie_count',    type: 'REAL DEFAULT 0' },
    { name: 'coolie_rate',     type: 'REAL DEFAULT 0' },
    { name: 'helper_count',    type: 'REAL DEFAULT 0' },
    { name: 'helper_rate',     type: 'REAL DEFAULT 0' },
    { name: 'other_count',     type: 'REAL DEFAULT 0' },
    { name: 'other_rate',      type: 'REAL DEFAULT 0' },
    { name: 'has_gst',         type: 'INTEGER DEFAULT 0' },
    { name: 'gst_rate',        type: 'REAL DEFAULT 0' },
    { name: 'gst_amount',      type: 'REAL DEFAULT 0' },
    { name: 'attachment_path', type: 'TEXT' },
    { name: 'invoice_no',      type: 'TEXT' },
    { name: 'unit',            type: 'TEXT' },
    { name: 'round_off',       type: 'INTEGER DEFAULT 0' },
    { name: 'round_off_amount', type: 'REAL DEFAULT 0' },
  ];
  for (const col of migrateCols) {
    try {
      db.exec(`ALTER TABLE expenses ADD COLUMN ${col.name} ${col.type}`);
    } catch (err: any) {
      if (!err?.message?.includes('duplicate column')) {
        console.error(`[db] Migration warning for column "${col.name}":`, err?.message);
      }
    }
  }

  // vendor_settlements migrations
  const settMigrations = [
    { name: 'use_settlement', type: 'INTEGER DEFAULT 0' },
  ];
  for (const col of settMigrations) {
    try {
      db.exec(`ALTER TABLE vendor_settlements ADD COLUMN ${col.name} ${col.type}`);
    } catch (err: any) {
      if (!err?.message?.includes('duplicate column')) {
        console.error(`[db] Migration warning for vendor_settlements.${col.name}:`, err?.message);
      }
    }
  }
}
