/**
 * Provider-neutral repository source-evidence selection policy.
 * Pure predicates and bounds — no I/O, storage, or provider clients.
 */

/** Maximum UTF-8 bytes per eligible source file (post-decode evidence bound). */
export const REPOSITORY_EVIDENCE_MAX_FILE_BYTES = 500_000;

/** Maximum repository paths considered per evidence collection pass. */
export const REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES = 1_000;

/** Default glob patterns for JavaScript/TypeScript source evidence paths. */
export const REPOSITORY_EVIDENCE_DEFAULT_GLOB_PATTERNS = [
  "*.ts",
  "*.tsx",
  "*.js",
  "*.jsx",
  "*.mjs",
  "*.cjs",
] as const;

/**
 * Path segment markers excluded from repository source evidence.
 * Matched as substring segments (e.g. `node_modules/` anywhere in the path).
 */
export const REPOSITORY_EVIDENCE_EXCLUDED_PATH_MARKERS = [
  "node_modules/",
  ".next/",
  "dist/",
  "build/",
  ".git/",
  "coverage/",
  ".turbo/",
  ".cache/",
  "public/",
  "static/",
  "assets/",
  "__tests__/",
  "__mocks__/",
  "test/",
  "tests/",
  "spec/",
  "specs/",
] as const;

export function normalizeRepositoryRelativePath(path: string): string {
  const trimmed = path.trim().replace(/\\/g, "/");
  return trimmed.startsWith("./") ? trimmed.slice(2) : trimmed;
}

function matchesRepositoryEvidenceGlob(path: string, pattern: string): boolean {
  const regex = new RegExp(pattern.replace(/\*/g, ".*").replace(/\./g, "\\."));
  return regex.test(path);
}

export function isRepositoryEvidencePathExcluded(path: string): boolean {
  const normalized = normalizeRepositoryRelativePath(path);
  return REPOSITORY_EVIDENCE_EXCLUDED_PATH_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
}

export function isRepositoryEvidencePathEligible(
  path: string,
  patterns: readonly string[] = REPOSITORY_EVIDENCE_DEFAULT_GLOB_PATTERNS,
): boolean {
  const normalized = normalizeRepositoryRelativePath(path);
  if (!normalized || isRepositoryEvidencePathExcluded(normalized)) {
    return false;
  }
  return patterns.some((pattern) =>
    matchesRepositoryEvidenceGlob(normalized, pattern),
  );
}

export function repositoryEvidenceFilePriority(path: string): number {
  const normalized = normalizeRepositoryRelativePath(path);
  let score = 0;

  const entryPoints = [
    "index.ts",
    "index.tsx",
    "index.js",
    "main.ts",
    "server.ts",
    "app.ts",
  ];
  if (entryPoints.some((entry) => normalized.endsWith(entry))) score += 100;

  const criticalPaths = [
    "auth/",
    "authentication/",
    "api/",
    "core/",
    "db/",
    "payment/",
    "checkout/",
  ];
  if (criticalPaths.some((segment) => normalized.includes(segment))) {
    score += 50;
  }

  const sourceDirs = ["src/", "lib/", "app/", "pages/", "components/"];
  if (sourceDirs.some((segment) => normalized.includes(segment))) {
    score += 25;
  }

  if (normalized.endsWith(".ts") || normalized.endsWith(".tsx")) score += 10;
  score -= normalized.split("/").length;
  return score;
}

export function prioritizeRepositoryEvidencePaths(
  paths: readonly string[],
  options: {
    maxFiles?: number;
    patterns?: readonly string[];
  } = {},
): string[] {
  const maxFiles = options.maxFiles ?? REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES;
  const patterns =
    options.patterns ?? REPOSITORY_EVIDENCE_DEFAULT_GLOB_PATTERNS;

  return [...paths]
    .map(normalizeRepositoryRelativePath)
    .filter((path) => isRepositoryEvidencePathEligible(path, patterns))
    .sort(
      (a, b) =>
        repositoryEvidenceFilePriority(b) - repositoryEvidenceFilePriority(a),
    )
    .slice(0, maxFiles);
}
