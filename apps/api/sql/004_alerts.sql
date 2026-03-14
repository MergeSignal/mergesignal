CREATE TABLE IF NOT EXISTS repo_sources (
  repo_id         TEXT PRIMARY KEY,
  provider        TEXT NOT NULL DEFAULT 'github',
  owner           TEXT NOT NULL,
  repo            TEXT NOT NULL,
  installation_id BIGINT NOT NULL,
  lockfile_path   TEXT NOT NULL,
  lockfile_manager TEXT NOT NULL,
  default_branch  TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS repo_sources_owner_repo_idx ON repo_sources(owner, repo);

CREATE TABLE IF NOT EXISTS alerts (
  id          TEXT PRIMARY KEY,
  repo_id     TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  type        TEXT NOT NULL,
  severity    TEXT NOT NULL,
  title       TEXT NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS alerts_repo_fingerprint_uniq ON alerts(repo_id, fingerprint);
CREATE INDEX IF NOT EXISTS alerts_repo_created_at_idx ON alerts(repo_id, created_at DESC);

