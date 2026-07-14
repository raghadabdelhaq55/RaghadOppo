const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const SCHEMA = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
const DEFAULT_FILE = path.join(__dirname, "..", "data", "app.db");

/**
 * Open (or create) a SQLite database and apply the schema idempotently.
 * Pass ":memory:" for tests. Returns the better-sqlite3 handle.
 */
function createDb(file = DEFAULT_FILE) {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

// Lazily-opened shared handle for the running server.
let shared = null;
function getDb() {
  if (!shared) shared = createDb(process.env.DB_FILE || DEFAULT_FILE);
  return shared;
}

module.exports = { createDb, getDb, DEFAULT_FILE };
