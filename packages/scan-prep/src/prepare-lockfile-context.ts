import type {
  AnalysisContextWarning,
  LockfileEvidenceStatus,
  LockfilePackageDelta,
  ScanQueueJob,
} from "@mergesignal/shared";

import {
  compareLockfileEvidence,
  lockfileComparisonExpected,
} from "./lockfile-evidence-comparison.js";
import {
  packageJsonManifestPathsFromChangedFiles,
  type LockfileDiffOptions,
} from "./lockfile-diff.js";
import { logWarn } from "./log.js";

export type LockfileContextResult = {
  changedPackages: string[];
  lockfilePackageDelta?: LockfilePackageDelta;
  evidenceStatus: LockfileEvidenceStatus;
  warnings: AnalysisContextWarning[];
};

export type { LockfileEvidenceStatus } from "@mergesignal/shared";

/** Production webhook may attach manifest paths beyond the shared type surface. */
type ScanJobWithManifestHints = ScanQueueJob & {
  changedPackageJsonFiles?: string[];
};

function warn(
  warnings: AnalysisContextWarning[],
  code: AnalysisContextWarning["code"],
  message: string,
  details?: Record<string, unknown>,
): void {
  warnings.push({ code, message, details });
}

function lockfileDiffOptionsFromJob(
  job: ScanQueueJob,
): LockfileDiffOptions | undefined {
  const explicit = (job as ScanJobWithManifestHints).changedPackageJsonFiles;
  const fromChangedFiles = packageJsonManifestPathsFromChangedFiles(
    job.changedFiles,
  );
  const manifests =
    explicit && explicit.length > 0 ? explicit : fromChangedFiles;
  return manifests && manifests.length > 0
    ? { changedPackageJsonFiles: manifests }
    : undefined;
}

const NOT_APPLICABLE: LockfileEvidenceStatus = { kind: "not_applicable" };

export function prepareLockfileContext(
  job: ScanQueueJob,
): LockfileContextResult {
  const warnings: AnalysisContextWarning[] = [];
  const { lockfile, baseLockfile } = job;
  const comparisonExpected = lockfileComparisonExpected(job);
  const lockfileDiffOptions = lockfileDiffOptionsFromJob(job);

  if (!lockfile && !baseLockfile) {
    return {
      changedPackages: [],
      evidenceStatus: NOT_APPLICABLE,
      warnings,
    };
  }

  if (lockfile && !baseLockfile) {
    const status: LockfileEvidenceStatus = {
      kind: "unavailable",
      reason: "missing_base",
    };
    if (comparisonExpected) {
      warn(
        warnings,
        "base_lockfile_missing",
        "Expected base lockfile for package comparison but none was available",
        { repoId: job.repoId, pr: job.github?.prNumber },
      );
    }
    return { changedPackages: [], evidenceStatus: status, warnings };
  }

  if (!lockfile && baseLockfile) {
    const status: LockfileEvidenceStatus = {
      kind: "unavailable",
      reason: "missing_head",
    };
    if (comparisonExpected) {
      warn(
        warnings,
        "lockfile_head_missing",
        "Expected head lockfile for package comparison but none was available",
        { repoId: job.repoId, pr: job.github?.prNumber },
      );
    }
    return { changedPackages: [], evidenceStatus: status, warnings };
  }

  if (!lockfile || !baseLockfile) {
    return {
      changedPackages: [],
      evidenceStatus: NOT_APPLICABLE,
      warnings,
    };
  }

  if (baseLockfile.manager !== lockfile.manager) {
    warn(
      warnings,
      "lockfile_diff_skipped",
      "Base and head lockfile managers differ; skipping package diff",
      { base: baseLockfile.manager, head: lockfile.manager },
    );
    return {
      changedPackages: [],
      evidenceStatus: {
        kind: "unavailable",
        reason: "manager_mismatch",
      },
      warnings,
    };
  }

  try {
    const comparison = compareLockfileEvidence({
      baseContent: baseLockfile.content,
      headContent: lockfile.content,
      manager: lockfile.manager,
      options: lockfileDiffOptions,
    });

    if (comparison.evidenceStatus.kind === "unavailable") {
      if (comparison.evidenceStatus.reason === "incomplete_parse") {
        warn(
          warnings,
          "lockfile_evidence_incomplete",
          "Lockfile comparison could not be verified complete; dependency delta suppressed",
          { repoId: job.repoId, manager: lockfile.manager },
        );
      }
      return {
        changedPackages: [],
        evidenceStatus: comparison.evidenceStatus,
        warnings,
      };
    }

    return {
      changedPackages: comparison.changedPackages,
      lockfilePackageDelta: comparison.lockfilePackageDelta,
      evidenceStatus: comparison.evidenceStatus,
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warn(
      warnings,
      "lockfile_diff_failed",
      "Failed to detect changed packages",
      {
        error: message,
      },
    );
    logWarn({ error: message, repoId: job.repoId }, "lockfile_diff_failed");
    return {
      changedPackages: [],
      evidenceStatus: {
        kind: "unavailable",
        reason: "comparison_failed",
      },
      warnings,
    };
  }
}
