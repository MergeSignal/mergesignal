ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS pr_risk_score INT,
  ADD COLUMN IF NOT EXISTS repository_health_score INT;

CREATE INDEX IF NOT EXISTS scans_repo_pr_risk_idx
  ON scans (repo_id, github_pr_number, pr_risk_score DESC)
  WHERE github_pr_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS scans_repo_health_idx
  ON scans (repo_id, repository_health_score DESC)
  WHERE status = 'done' AND repository_health_score IS NOT NULL;

UPDATE scans
SET
  pr_risk_score = NULLIF(result->'prRisk'->>'score', '')::int,
  repository_health_score = NULLIF(result->'repositoryHealth'->>'totalScore', '')::int
WHERE result IS NOT NULL
  AND (pr_risk_score IS NULL OR repository_health_score IS NULL);
