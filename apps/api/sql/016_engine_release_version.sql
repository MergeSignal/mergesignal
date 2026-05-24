-- Engine release traceability (deployed engine version, distinct from methodology_version).
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS engine_release_version TEXT,
  ADD COLUMN IF NOT EXISTS engine_release_git_sha TEXT;

CREATE INDEX IF NOT EXISTS scans_engine_release_version_idx
  ON scans (engine_release_version);
