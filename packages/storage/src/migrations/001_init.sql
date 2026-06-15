CREATE TABLE IF NOT EXISTS identity (
  id          TEXT PRIMARY KEY,
  nickname    TEXT NOT NULL,
  public_key  BLOB NOT NULL,
  private_key BLOB NOT NULL,
  signing_public_key  BLOB NOT NULL,
  signing_private_key BLOB NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS envelopes (
  envelope_id    TEXT PRIMARY KEY,
  protocol_ver   INTEGER NOT NULL,
  timestamp_utc  INTEGER NOT NULL,
  sender_device  TEXT NOT NULL,
  sender_nick    TEXT NOT NULL,
  chat_scope     TEXT NOT NULL,
  room_id        TEXT,
  message_type   TEXT NOT NULL,
  payload        BLOB NOT NULL,
  ttl_hops       INTEGER NOT NULL,
  signature      BLOB NOT NULL,
  enc_algorithm  TEXT NOT NULL,
  enc_nonce      BLOB NOT NULL,
  enc_epk        BLOB NOT NULL,
  received_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_envelopes_scope
  ON envelopes(chat_scope, sender_device, timestamp_utc);

CREATE INDEX IF NOT EXISTS idx_envelopes_room
  ON envelopes(room_id, timestamp_utc);

CREATE TABLE IF NOT EXISTS contacts (
  device_id          TEXT PRIMARY KEY,
  nickname           TEXT NOT NULL,
  public_key         BLOB NOT NULL,
  signing_public_key BLOB NOT NULL,
  trust_state        TEXT NOT NULL DEFAULT 'unverified',
  first_seen_at      INTEGER NOT NULL,
  last_seen_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  member_ids TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
