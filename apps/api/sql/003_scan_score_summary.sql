ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS total_score INT,
  ADD COLUMN IF NOT EXISTS layer_security INT,
  ADD COLUMN IF NOT EXISTS layer_maintainability INT,
  ADD COLUMN IF NOT EXISTS layer_ecosystem INT,
  ADD COLUMN IF NOT EXISTS layer_upgrade_impact INT,
  ADD COLUMN IF NOT EXISTS methodology_version TEXT,
  ADD COLUMN IF NOT EXISTS result_generated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS scans_repo_created_at_idx ON scans(repo_id, created_at DESC);

UPDATE scans
SET
  total_score = NULLIF(result->>'totalScore','')::int,
  layer_security = NULLIF(result->'layerScores'->>'security','')::int,
  layer_maintainability = NULLIF(result->'layerScores'->>'maintainability','')::int,
  layer_ecosystem = NULLIF(result->'layerScores'->>'ecosystem','')::int,
  layer_upgrade_impact = NULLIF(result->'layerScores'->>'upgradeImpact','')::int,
  methodology_version = NULLIF(result->>'methodologyVersion',''),
  result_generated_at = NULLIF(result->>'generatedAt','')::timestamptz
WHERE result IS NOT NULL
  AND total_score IS NULL;

