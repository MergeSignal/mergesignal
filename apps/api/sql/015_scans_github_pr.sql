-- Persist GitHub PR identity on scan rows so the dashboard can group
-- scans by PR number and detect stale coverage (head SHA mismatch).
-- These columns are NULL for manual/push scans; only webhook PR scans
-- (source='github', triggered via handlePullRequest) populate them.

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS github_pr_number INT,
  ADD COLUMN IF NOT EXISTS github_head_sha  TEXT,
  ADD COLUMN IF NOT EXISTS github_base_ref  TEXT,
  ADD COLUMN IF NOT EXISTS github_base_sha  TEXT;

-- Efficient "latest scan per open PR" query:
--   DISTINCT ON (github_pr_number) ORDER BY github_pr_number, created_at DESC
CREATE INDEX IF NOT EXISTS scans_pr_repo_created_idx
  ON scans (repo_id, github_pr_number, created_at DESC)
  WHERE github_pr_number IS NOT NULL;
