/**
 * Provider-neutral repository source-evidence selection policy.
 * Pure predicates and bounds — no I/O, storage, or provider clients.
 *
 * Input paths must be canonical repository-relative paths from acquisition adapters.
 */

/** Maximum UTF-8 bytes per eligible source file (post-decode evidence bound). */
export const REPOSITORY_EVIDENCE_MAX_FILE_BYTES = 500_000;

/** Maximum repository paths considered per evidence collection pass. */
export const REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES = 1_000;

/** Governed terminal source extensions for full-tree corpus evidence (longest-match order). */
export const REPOSITORY_EVIDENCE_SOURCE_EXTENSIONS = Object.freeze([
  ".tsx",
  ".mts",
  ".cts",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".js",
] as const);

const REPOSITORY_EVIDENCE_SOURCE_EXTENSION_SET: ReadonlySet<string> = new Set(
  REPOSITORY_EVIDENCE_SOURCE_EXTENSIONS,
);

const TYPESCRIPT_IMPLEMENTABLE_BONUS_EXTENSIONS: ReadonlySet<string> = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);

/**
 * Path segment markers excluded from repository source evidence.
 * Matched as substring segments (e.g. `node_modules/` anywhere in the path).
 */
export const REPOSITORY_EVIDENCE_EXCLUDED_PATH_MARKERS = Object.freeze([
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
] as const);

/** Lexicographic order on paths (UTF-16 code units, locale-independent). */
export function compareRepositoryRelativePaths(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Whether the path is a canonical repository-relative path (adapter contract). */
export function isCanonicalRepositoryRelativePath(path: string): boolean {
  if (path.length === 0) return false;
  if (path.startsWith("./") || path.startsWith("/")) return false;
  if (/^[A-Za-z]:/.test(path)) return false;
  return true;
}

/** Terminal governed source extension for a path, or null if not eligible by extension. */
export function terminalRepositorySourceExtension(path: string): string | null {
  if (path.endsWith(".d.ts")) return null;
  for (const ext of REPOSITORY_EVIDENCE_SOURCE_EXTENSIONS) {
    if (path.endsWith(ext)) return ext;
  }
  return null;
}

export function isRepositoryEvidencePathExcluded(path: string): boolean {
  return REPOSITORY_EVIDENCE_EXCLUDED_PATH_MARKERS.some((marker) =>
    path.includes(marker),
  );
}

export function isRepositoryEvidencePathEligible(path: string): boolean {
  if (!isCanonicalRepositoryRelativePath(path)) return false;
  if (isRepositoryEvidencePathExcluded(path)) return false;
  const ext = terminalRepositorySourceExtension(path);
  return ext !== null && REPOSITORY_EVIDENCE_SOURCE_EXTENSION_SET.has(ext);
}

export function repositoryEvidenceFilePriority(path: string): number {
  let score = 0;

  const entryPoints = [
    "index.ts",
    "index.tsx",
    "index.js",
    "main.ts",
    "server.ts",
    "app.ts",
  ];
  if (entryPoints.some((entry) => path.endsWith(entry))) score += 100;

  const criticalPaths = [
    "auth/",
    "authentication/",
    "api/",
    "core/",
    "db/",
    "payment/",
    "checkout/",
  ];
  if (criticalPaths.some((segment) => path.includes(segment))) {
    score += 50;
  }

  const sourceDirs = ["src/", "lib/", "app/", "pages/", "components/"];
  if (sourceDirs.some((segment) => path.includes(segment))) {
    score += 25;
  }

  const ext = terminalRepositorySourceExtension(path);
  if (ext !== null && TYPESCRIPT_IMPLEMENTABLE_BONUS_EXTENSIONS.has(ext)) {
    score += 10;
  }
  score -= path.split("/").length;
  return score;
}

/** Internal selection result — not exported from @mergesignal/scan-prep/repository-evidence. */
type RepositoryEvidenceCandidateSelection = {
  selectedPaths: string[];
  eligibleCandidateCount: number;
  selectedCandidateCount: number;
  capTruncatedCandidateCount: number;
};

export function selectRepositoryEvidenceCandidatePaths(
  paths: readonly string[],
): RepositoryEvidenceCandidateSelection {
  const eligibleUnique = [
    ...new Set(paths.filter(isRepositoryEvidencePathEligible)),
  ];

  const selectedPaths = eligibleUnique
    .sort((a, b) => {
      const byPriority =
        repositoryEvidenceFilePriority(b) - repositoryEvidenceFilePriority(a);
      if (byPriority !== 0) return byPriority;
      return compareRepositoryRelativePaths(a, b);
    })
    .slice(0, REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES);

  const eligibleCandidateCount = eligibleUnique.length;
  const selectedCandidateCount = selectedPaths.length;
  const capTruncatedCandidateCount = Math.max(
    0,
    eligibleCandidateCount - selectedCandidateCount,
  );

  return {
    selectedPaths,
    eligibleCandidateCount,
    selectedCandidateCount,
    capTruncatedCandidateCount,
  };
}

export function prioritizeRepositoryEvidencePaths(
  paths: readonly string[],
): string[] {
  return selectRepositoryEvidenceCandidatePaths(paths).selectedPaths;
}
