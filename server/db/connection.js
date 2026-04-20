const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'fleet.db');

let db = null;

/**
 * Initialize the SQLite database (async — loads WASM).
 * Loads from file if exists, otherwise creates a new empty DB.
 * Must be called (and awaited) before using any other function.
 */
async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON;');

  console.log('[DB] Connected to', DB_PATH);
  return db;
}

/**
 * Persist current in-memory DB state to disk.
 * Must be called after any write operation (INSERT/UPDATE/DELETE).
 */
function save() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Get the raw sql.js Database instance.
 */
function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

/**
 * Query a single row. Returns plain object or null.
 * Use for SELECT that returns one row.
 */
function get(sql, params = []) {
  if (!db) throw new Error('Database not initialized.');
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);

  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

/**
 * Run a single SQL statement with optional params.
 * Use for INSERT, UPDATE, DELETE. Auto-saves to disk.
 * Returns { changes: number }
 */
function run(sql, params = []) {
  if (!db) throw new Error('Database not initialized.');
  db.run(sql, params);
  save();
  const result = db.exec('SELECT changes() AS changes');
  return { changes: result.length > 0 ? result[0].values[0][0] : 0 };
}

module.exports = { initDb, save, getDb, get, run };
