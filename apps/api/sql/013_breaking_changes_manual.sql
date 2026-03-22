-- Manual Breaking Changes Database
-- 
-- Allows manual curation of known breaking changes for better detection accuracy.
-- This provides high-confidence breaking change data that overrides heuristics.

CREATE TABLE IF NOT EXISTS breaking_changes_manual (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  package_name TEXT NOT NULL,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  affected_apis TEXT[], -- Array of API names that changed
  migration_guide TEXT, -- Optional migration guide URL or instructions
  source_url TEXT, -- Link to changelog, release notes, or documentation
  added_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups by package and version
CREATE INDEX IF NOT EXISTS breaking_changes_package_version_idx 
  ON breaking_changes_manual(package_name, from_version, to_version);

-- Index for querying by package name
CREATE INDEX IF NOT EXISTS breaking_changes_package_name_idx 
  ON breaking_changes_manual(package_name);

-- Seed with some well-known breaking changes for popular packages
INSERT INTO breaking_changes_manual (package_name, from_version, to_version, severity, description, affected_apis, source_url)
VALUES 
  ('react', '17.0.0', '18.0.0', 'medium', 'React.FC no longer provides children prop by default', ARRAY['React.FC'], 'https://react.dev/blog/2022/03/08/react-18-upgrade-guide'),
  ('react', '17.0.0', '18.0.0', 'low', 'Automatic batching behavior changed for updates', ARRAY['setState'], 'https://react.dev/blog/2022/03/08/react-18-upgrade-guide'),
  ('next', '12.0.0', '13.0.0', 'high', 'App directory router replaces pages router', ARRAY['next/link', 'next/router'], 'https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration'),
  ('express', '4.0.0', '5.0.0', 'medium', 'Callback signature changed for error handlers', ARRAY['app.use'], 'https://expressjs.com/en/guide/migrating-5.html')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE breaking_changes_manual IS 'Manually curated breaking changes for improved detection accuracy';
COMMENT ON COLUMN breaking_changes_manual.affected_apis IS 'Array of API names, function names, or exports that changed';
COMMENT ON COLUMN breaking_changes_manual.severity IS 'Impact level: low, medium, high, critical';
