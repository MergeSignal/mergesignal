-- GitHub surface publish marker: dashboard "ready" requires this timestamp.
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS github_surfaces_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS github_surfaces_publish_error TEXT;

CREATE INDEX IF NOT EXISTS scans_repo_pr_head_surfaced_idx
  ON scans (repo_id, github_pr_number, github_head_sha, github_surfaces_published_at DESC)
  WHERE github_pr_number IS NOT NULL;
