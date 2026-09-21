-- ============================================================
--  D1 Schema: clicks
--  Run via: wrangler d1 execute portfolio-db --file=schema.sql
-- ============================================================

-- Photos are append-only. No UPDATE or DELETE is ever issued
-- against this table from the application layer.
CREATE TABLE IF NOT EXISTS clicks (
  id          TEXT PRIMARY KEY,          -- UUID v4
  r2_key      TEXT NOT NULL UNIQUE,      -- key inside R2 bucket
  caption     TEXT NOT NULL DEFAULT '',  -- optional caption (immutable after insert)
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast chronological listing (insertion order is permanent)
CREATE INDEX IF NOT EXISTS idx_clicks_uploaded_at ON clicks(uploaded_at ASC);
