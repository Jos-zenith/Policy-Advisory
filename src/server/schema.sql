-- Famsurance schema (CLAUDE.md §11). SQLite via better-sqlite3.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

-- Append-only decision trail. Detail is AES-256-GCM encrypted.
CREATE TABLE IF NOT EXISTS trail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  event TEXT NOT NULL,
  detail_enc BLOB,
  rule_id TEXT,
  config_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS trail_session ON trail(session_id, id);

CREATE TRIGGER IF NOT EXISTS trail_no_update BEFORE UPDATE ON trail
BEGIN
  SELECT RAISE(ABORT, 'trail is append-only');
END;
CREATE TRIGGER IF NOT EXISTS trail_no_delete BEFORE DELETE ON trail
BEGIN
  SELECT RAISE(ABORT, 'trail is append-only');
END;

CREATE TABLE IF NOT EXISTS advisors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  languages_json TEXT NOT NULL,
  specialities_json TEXT NOT NULL,
  licence_ref TEXT NOT NULL,
  licence_valid_to TEXT,
  is_sample INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  advisor_id TEXT NOT NULL REFERENCES advisors(id),
  start_utc TEXT NOT NULL,
  end_utc TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  booked INTEGER NOT NULL DEFAULT 0,
  CHECK (booked >= 0 AND booked <= capacity)
);
CREATE INDEX IF NOT EXISTS slots_start ON slots(start_utc);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  slot_id TEXT NOT NULL REFERENCES slots(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  customer_enc BLOB NOT NULL,
  consents_json TEXT NOT NULL,
  handoff_snapshot_enc BLOB NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  seq INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bookings_session ON bookings(session_id);

-- The handoff snapshot is immutable once written.
CREATE TRIGGER IF NOT EXISTS bookings_snapshot_immutable BEFORE UPDATE OF handoff_snapshot_enc, customer_enc, session_id, slot_id ON bookings
BEGIN
  SELECT RAISE(ABORT, 'booking snapshot is immutable');
END;

CREATE TABLE IF NOT EXISTS handoff_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  viewer TEXT NOT NULL,
  ts TEXT NOT NULL
);
