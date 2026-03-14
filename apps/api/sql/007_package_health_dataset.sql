CREATE TABLE IF NOT EXISTS package_health (
  name TEXT PRIMARY KEY,
  registry TEXT NOT NULL DEFAULT 'npm',
  latest_version TEXT NULL,
  latest_published_at TIMESTAMPTZ NULL,
  modified_at TIMESTAMPTZ NULL,
  deprecated BOOLEAN NOT NULL DEFAULT FALSE,
  maintainers_count INT NULL,
  repository_url TEXT NULL,
  last_fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw JSONB NULL
);

CREATE INDEX IF NOT EXISTS package_health_last_fetched_at_idx
  ON package_health (last_fetched_at DESC);

CREATE TABLE IF NOT EXISTS package_health_snapshots (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  registry TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  fetched_day DATE NOT NULL,
  source_repo_id TEXT NULL,
  source_scan_id UUID NULL,
  latest_version TEXT NULL,
  latest_published_at TIMESTAMPTZ NULL,
  modified_at TIMESTAMPTZ NULL,
  deprecated BOOLEAN NOT NULL DEFAULT FALSE,
  maintainers_count INT NULL,
  repository_url TEXT NULL,
  raw JSONB NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS package_health_snapshots_name_day_uniq
  ON package_health_snapshots (name, fetched_day);

CREATE INDEX IF NOT EXISTS package_health_snapshots_name_fetched_at_idx
  ON package_health_snapshots (name, fetched_at DESC);

