/**
 * Canonical frozen export surface for `@mergesignal/scan-prep`.
 * Authority: docs/engineering/scan-prep-api.md
 *
 * Single source of truth for CI and package tests — do not duplicate lists elsewhere.
 */
export const APPROVED_ROOT_RUNTIME = ["prepareScanContext"] as const;

export const APPROVED_ROOT_TYPES = [
  "PrepareScanContextResult",
  "ScanPreparationSummary",
] as const;

export const APPROVED_LOCKFILE_RUNTIME = [
  "hasVerifiedLockfileIngress",
  "hasVerifiedEmptyLockfileIngress",
  "prepareLockfileContext",
  "detectChangedPackages",
  "detectLockfilePackageDelta",
  "resolvePnpmPackageTransitionCollapse",
  "collectPnpmImporterTransitionFacts",
  "collapsePnpmImporterTransitions",
  "packageJsonManifestPathsFromChangedFiles",
  "normalizePnpmResolvedVersion",
  "importerManifestPath",
  "isPnpmLockfileDiffEmpty",
] as const;

export const APPROVED_LOCKFILE_TYPES = [
  "LockfileContextResult",
  "LockfileDiffOptions",
  "LockfileEvidenceStatus",
  "PnpmImporterTransitionFact",
  "PnpmPackageTransitionCollapse",
  "CollapsedPackageTransition",
  "ImporterTransitionChangeKind",
] as const;

export const PROHIBITED_RUNTIME = [
  "fetchGitHubFiles",
  "classifyFetchError",
  "getInstallationToken",
  "clearTokenCache",
  "getCachedFiles",
  "setCachedFiles",
  "clearCache",
  "cleanupExpiredEntries",
  "__resetFileCacheForTests",
  "fetchTier3Corpus",
  "executeCollectionPlan",
] as const;

export const APPROVED_PACKAGE_EXPORTS = [
  ".",
  "./lockfile",
  "./repository-evidence",
] as const;

export const APPROVED_REPOSITORY_EVIDENCE_RUNTIME = [
  "REPOSITORY_EVIDENCE_DEFAULT_GLOB_PATTERNS",
  "REPOSITORY_EVIDENCE_EXCLUDED_PATH_MARKERS",
  "REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES",
  "REPOSITORY_EVIDENCE_MAX_FILE_BYTES",
  "filterChangeRequestChangedSourcePaths",
  "isChangeRequestChangedSourcePathEligible",
  "isRepositoryEvidencePathEligible",
  "isRepositoryEvidencePathExcluded",
  "normalizeRepositoryRelativePath",
  "prioritizeRepositoryEvidencePaths",
  "repositoryEvidenceFilePriority",
] as const;

export const APPROVED_REPOSITORY_EVIDENCE_TYPES = [] as const;
