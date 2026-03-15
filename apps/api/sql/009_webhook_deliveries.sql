CREATE TABLE IF NOT EXISTS webhook_deliveries (
  delivery_id   TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  repo_id       TEXT,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scan_id       TEXT
);

CREATE INDEX webhook_deliveries_processed_at_idx ON webhook_deliveries(processed_at DESC);
