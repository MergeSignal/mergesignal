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

export const APPROVED_PACKAGE_EXPORTS = [".", "./lockfile"] as const;
