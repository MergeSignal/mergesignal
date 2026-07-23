/**
 * Approved lockfile ingress surface for `@mergesignal/scan-prep/lockfile`.
 * Authority: docs/engineering/scan-prep-api.md
 */
export {
  detectChangedPackages,
  detectLockfilePackageDelta,
  importerManifestPath,
  isPnpmLockfileDiffEmpty,
  normalizePnpmResolvedVersion,
  packageJsonManifestPathsFromChangedFiles,
  collectPnpmImporterTransitionFacts,
  collapsePnpmImporterTransitions,
  resolvePnpmPackageTransitionCollapse,
  type LockfileDiffOptions,
  type CollapsedPackageTransition,
  type ImporterTransitionChangeKind,
  type PnpmImporterTransitionFact,
  type PnpmPackageTransitionCollapse,
} from "./lockfile-diff.js";
export {
  prepareLockfileContext,
  type LockfileContextResult,
  type LockfileEvidenceStatus,
} from "./prepare-lockfile-context.js";
export {
  hasVerifiedEmptyLockfileIngress,
  hasVerifiedLockfileIngress,
} from "./lockfile-evidence-ingress.js";
