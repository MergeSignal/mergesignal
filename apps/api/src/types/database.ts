// Database type definitions derived from SQL schema
// These types provide compile-time safety for queries

export type ScanStatus = "queued" | "running" | "done" | "failed";

export interface Scan {
  id: string;
  repo_id: string;
  status: ScanStatus;
  source: string;
  attempt: number;
  worker_id: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  heartbeat_at: Date | null;
  total_score: number | null;
  layer_security: number | null;
  layer_maintainability: number | null;
  layer_ecosystem: number | null;
  layer_upgrade_impact: number | null;
  methodology_version: string | null;
  result_generated_at: Date | null;
  result: unknown | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RepoSource {
  repo_id: string;
  provider: string;
  owner: string;
  repo: string;
  installation_id: bigint;
  lockfile_path: string;
  lockfile_manager: string;
  default_branch: string | null;
  last_checked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Alert {
  id: string;
  repo_id: string;
  fingerprint: string;
  type: string;
  severity: string;
  title: string;
  details: unknown | null;
  created_at: Date;
}

export interface Policy {
  id: string;
  owner: string;
  name: string;
  enabled: boolean;
  rules: unknown;
  created_at: Date;
  updated_at: Date;
}

export interface PolicyViolation {
  id: string;
  policy_id: string;
  owner: string;
  repo_id: string;
  fingerprint: string;
  severity: string;
  title: string;
  details: unknown | null;
  created_at: Date;
}

export interface ApiKey {
  id: string;
  key_hash: string;
  owner: string;
  description: string | null;
  created_at: Date;
  last_used_at: Date | null;
}

export interface PackageHealth {
  name: string;
  registry: string;
  latest_version: string | null;
  latest_published_at: Date | null;
  modified_at: Date | null;
  deprecated: boolean;
  maintainers_count: number | null;
  repository_url: string | null;
  last_fetched_at: Date;
  raw: unknown | null;
}

export interface PackageHealthSnapshot {
  id: string;
  name: string;
  registry: string;
  fetched_at: Date;
  fetched_day: Date;
  source_repo_id: string | null;
  source_scan_id: string | null;
  latest_version: string | null;
  latest_published_at: Date | null;
  modified_at: Date | null;
  deprecated: boolean;
  maintainers_count: number | null;
  repository_url: string | null;
  raw: unknown | null;
}
