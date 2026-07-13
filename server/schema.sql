-- Bill Splitter v2 schema (SQLite). Applied idempotently on boot by db.js.
-- Money is stored in integer cents. Timestamps are ISO-8601 strings (UTC).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT,               -- NULL for imported/invited "shadow" users
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  base_currency TEXT    NOT NULL DEFAULT 'USD',
  owner_id      INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  role      TEXT    NOT NULL DEFAULT 'member', -- owner | admin | member
  joined_at TEXT    NOT NULL,
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS invites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  email      TEXT    NOT NULL,
  token      TEXT    NOT NULL UNIQUE,
  invited_by INTEGER NOT NULL REFERENCES users(id),
  status     TEXT    NOT NULL DEFAULT 'pending', -- pending | accepted | revoked
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description  TEXT    NOT NULL DEFAULT '',
  payer_id     INTEGER NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL,        -- in `currency`
  currency     TEXT    NOT NULL DEFAULT 'USD',
  rate_to_base REAL    NOT NULL DEFAULT 1, -- snapshot: multiply to reach base currency
  split_type   TEXT    NOT NULL DEFAULT 'equal', -- equal | exact | percent
  date         TEXT    NOT NULL,
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_shares (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id  INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  share_cents INTEGER NOT NULL          -- in the group's base currency
);

CREATE TABLE IF NOT EXISTS settlements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user    INTEGER NOT NULL REFERENCES users(id),
  to_user      INTEGER NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL,        -- base currency
  status       TEXT    NOT NULL DEFAULT 'pending', -- pending | confirmed | disputed
  marked_by    INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL,
  confirmed_at TEXT
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id          INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description       TEXT    NOT NULL,
  amount_cents      INTEGER NOT NULL,
  currency          TEXT    NOT NULL DEFAULT 'USD',
  cadence           TEXT    NOT NULL DEFAULT 'monthly',
  split_type        TEXT    NOT NULL DEFAULT 'equal',
  split_config_json TEXT    NOT NULL DEFAULT '{}',
  payer_id          INTEGER NOT NULL REFERENCES users(id),
  next_due          TEXT    NOT NULL,
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_instances (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recurring_id INTEGER NOT NULL REFERENCES recurring_expenses(id) ON DELETE CASCADE,
  group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  due_date     TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'pending', -- pending | approved | skipped
  approved_by  INTEGER REFERENCES users(id),
  expense_id   INTEGER REFERENCES expenses(id),
  created_at   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memberships_group ON memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_shares_expense ON expense_shares(expense_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id);
