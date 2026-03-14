CREATE TYPE scan_status AS ENUM ('queued', 'running', 'done', 'failed');

CREATE TABLE scans (
  id            TEXT PRIMARY KEY,
  repo_id       TEXT NOT NULL,
  status        scan_status NOT NULL DEFAULT 'queued',
  attempt       INT NOT NULL DEFAULT 0,
  worker_id     TEXT,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  heartbeat_at  TIMESTAMPTZ,
  total_score   INT,
  layer_security INT,
  layer_maintainability INT,
  layer_ecosystem INT,
  layer_upgrade_impact INT,
  methodology_version TEXT,
  result_generated_at TIMESTAMPTZ,
  result        JSONB,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX scans_repo_id_idx ON scans(repo_id);
CREATE INDEX scans_repo_created_at_idx ON scans(repo_id, created_at DESC);
CREATE INDEX scans_status_idx ON scans(status);
CREATE INDEX scans_running_heartbeat_idx ON scans(status, heartbeat_at);
