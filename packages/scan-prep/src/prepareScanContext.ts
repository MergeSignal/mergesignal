import type {
  AnalysisContextWarning,
  CodeAnalysisInput,
  CodeAnalysisMetrics,
  ScanQueueJob,
  ScanRequest,
} from "@mergesignal/shared";
import { scanAnalysisScopeFromQueueJob } from "@mergesignal/shared";

import { getCachedCorpus, setCachedCorpus } from "./file-cache.js";
import { classifyFetchError, fetchGitHubFiles } from "./github-files.js";
import { logInfo, logWarn } from "./log.js";
import { prepareLockfileContext } from "./prepare-lockfile-context.js";
import {
  aggregateSourceFilesSkipped,
  assertRepositoryEvidenceAcquisitionInvariants,
  type RepositoryEvidenceAcquisitionAccounting,
  ZERO_REPOSITORY_EVIDENCE_ACQUISITION,
} from "./repository-evidence-acquisition-accounting.js";

export type PrepareScanContextResult = {
  scanRequest: ScanRequest;
  codeAnalysis?: CodeAnalysisInput;
  warnings: AnalysisContextWarning[];
  preparationSummary: ScanPreparationSummary;
};

/**
 * Normalized preparation / acquisition observability. Semantics are multi-producer;
 * see docs/engineering/scan-prep-api.md § ScanPreparationSummary.
 */
export type ScanPreparationSummary = {
  changedPackageCount: number;
  lockfileDeltaAdded: number;
  lockfileDeltaRemoved: number;
  lockfileDeltaUpdated: number;
  changedFileCount: number;
  /** Successfully materialized analysis/source corpus size for this producer pass. */
  sourceFilesFetched: number;
  /**
   * Measured skips among repository-evidence paths this producer attempted.
   * Must equal sourceFilesSkippedOversized + sourceFilesSkippedFetchError.
   * prepareScanContext: cap-selected paths not in the fetched corpus (size or fetch failure).
   */
  sourceFilesSkipped: number;
  repositoryEvidenceEligibleCandidateCount: number;
  repositoryEvidenceSelectedCandidateCount: number;
  repositoryEvidenceCapTruncatedCandidateCount: number;
  sourceFilesSkippedOversized: number;
  sourceFilesSkippedFetchError: number;
  codeAnalysisEnabled: boolean;
  warningCodes: string[];
};

function warn(
  warnings: AnalysisContextWarning[],
  code: AnalysisContextWarning["code"],
  message: string,
  details?: Record<string, unknown>,
): void {
  warnings.push({ code, message, details });
}

function repositoryEvidenceFieldsFromAccounting(
  accounting: RepositoryEvidenceAcquisitionAccounting,
  sourceFilesFetched: number,
): Pick<
  ScanPreparationSummary,
  | "sourceFilesSkipped"
  | "repositoryEvidenceEligibleCandidateCount"
  | "repositoryEvidenceSelectedCandidateCount"
  | "repositoryEvidenceCapTruncatedCandidateCount"
  | "sourceFilesSkippedOversized"
  | "sourceFilesSkippedFetchError"
> {
  const sourceFilesSkipped = aggregateSourceFilesSkipped(accounting);
  assertRepositoryEvidenceAcquisitionInvariants({
    accounting,
    sourceFilesFetched,
    sourceFilesSkipped,
  });
  return {
    sourceFilesSkipped,
    ...accounting,
  };
}

export async function prepareScanContext(
  job: ScanQueueJob,
): Promise<PrepareScanContextResult> {
  const warnings: AnalysisContextWarning[] = [];
  const { repoSource, changedFiles } = job;

  const lockfileCtx = prepareLockfileContext(job);
  warnings.push(...lockfileCtx.warnings);
  const changedPackages = lockfileCtx.changedPackages;
  const lockfilePackageDelta = lockfileCtx.lockfilePackageDelta;
  const lockfileEvidenceStatus = lockfileCtx.evidenceStatus;

  let codeAnalysis: CodeAnalysisInput | undefined;
  const codeAnalysisMetrics: CodeAnalysisMetrics = {
    fromCache: false,
    filesAnalyzed: 0,
  };
  let sourceFilesFetched = 0;
  let repositoryEvidenceAccounting: RepositoryEvidenceAcquisitionAccounting =
    ZERO_REPOSITORY_EVIDENCE_ACQUISITION;

  if (repoSource && changedPackages.length > 0) {
    try {
      let fileContents: Map<string, string>;

      const cached = getCachedCorpus(repoSource);
      if (cached) {
        fileContents = cached.files;
        codeAnalysisMetrics.fromCache = true;
        codeAnalysisMetrics.filesAnalyzed = cached.files.size;
        sourceFilesFetched = cached.files.size;
        repositoryEvidenceAccounting = {
          repositoryEvidenceEligibleCandidateCount:
            cached.metrics.repositoryEvidenceEligibleCandidateCount,
          repositoryEvidenceSelectedCandidateCount:
            cached.metrics.repositoryEvidenceSelectedCandidateCount,
          repositoryEvidenceCapTruncatedCandidateCount:
            cached.metrics.repositoryEvidenceCapTruncatedCandidateCount,
          sourceFilesSkippedOversized:
            cached.metrics.sourceFilesSkippedOversized,
          sourceFilesSkippedFetchError:
            cached.metrics.sourceFilesSkippedFetchError,
        };
      } else {
        const fetchStart = Date.now();
        const fetchResult = await fetchGitHubFiles(repoSource, {
          timeoutMs: defaultFetchTimeoutMs(),
        });
        fileContents = fetchResult.files;
        repositoryEvidenceAccounting = {
          repositoryEvidenceEligibleCandidateCount:
            fetchResult.repositoryEvidenceEligibleCandidateCount,
          repositoryEvidenceSelectedCandidateCount:
            fetchResult.repositoryEvidenceSelectedCandidateCount,
          repositoryEvidenceCapTruncatedCandidateCount:
            fetchResult.repositoryEvidenceCapTruncatedCandidateCount,
          sourceFilesSkippedOversized: fetchResult.sourceFilesSkippedOversized,
          sourceFilesSkippedFetchError:
            fetchResult.sourceFilesSkippedFetchError,
        };
        codeAnalysisMetrics.analysisTimeMs = Date.now() - fetchStart;
        codeAnalysisMetrics.filesAnalyzed = fileContents.size;
        sourceFilesFetched = fileContents.size;

        let totalBytes = 0;
        for (const content of fileContents.values()) {
          totalBytes += Buffer.byteLength(content, "utf-8");
        }

        setCachedCorpus(repoSource, fileContents, {
          fileCount: fileContents.size,
          totalBytes,
          fetchTimeMs: codeAnalysisMetrics.analysisTimeMs ?? 0,
          ...repositoryEvidenceAccounting,
        });
      }

      if (fileContents.size === 0) {
        warn(
          warnings,
          "code_corpus_empty",
          "Source fetch returned zero files",
          {
            repoId: job.repoId,
            sha: repoSource.sha,
          },
        );
        codeAnalysis = undefined;
      } else {
        codeAnalysis = { fileContents, changedPackages };
        logInfo(
          {
            repoId: job.repoId,
            fileCount: fileContents.size,
            fromCache: codeAnalysisMetrics.fromCache,
          },
          "Prepared code analysis corpus",
        );
      }
    } catch (error) {
      const errorType = classifyFetchError(error);
      const message = error instanceof Error ? error.message : String(error);

      if (errorType === "timeout") {
        codeAnalysisMetrics.timedOut = true;
        warn(warnings, "code_fetch_timeout", message, { errorType });
      } else if (errorType === "rate_limit") {
        warn(warnings, "code_fetch_rate_limit", message, { errorType });
      } else if (errorType === "auth_failure") {
        warn(warnings, "code_fetch_auth_failure", message, { errorType });
      } else {
        warn(warnings, "code_fetch_failed", message, { errorType });
      }

      logWarn(
        { error: message, errorType, repoId: job.repoId },
        "Code corpus fetch failed",
      );
      codeAnalysis = undefined;
      sourceFilesFetched = 0;
      repositoryEvidenceAccounting = ZERO_REPOSITORY_EVIDENCE_ACQUISITION;
    }
  } else if (repoSource && changedPackages.length === 0) {
    warn(
      warnings,
      "code_fetch_skipped",
      "No changed packages; skipping source corpus fetch",
      { repoId: job.repoId },
    );
  } else if (!repoSource && changedPackages.length > 0) {
    warn(
      warnings,
      "code_fetch_skipped",
      "Changed packages present but repoSource missing",
      { repoId: job.repoId, changedPackageCount: changedPackages.length },
    );
  }

  const scanRequest: ScanRequest = {
    repoId: job.repoId,
    dependencyGraph: job.dependencyGraph ?? {},
    lockfile: job.lockfile,
    baseLockfile: job.baseLockfile,
    scanAnalysisScope: scanAnalysisScopeFromQueueJob(job),
    changedFiles,
    changedPackages,
    lockfilePackageDelta,
    lockfileEvidenceStatus,
    codeAnalysisMetrics:
      codeAnalysisMetrics.filesAnalyzed > 0 ||
      warnings.some((w) => w.code.startsWith("code_"))
        ? codeAnalysisMetrics
        : undefined,
  };

  const delta = lockfilePackageDelta ?? {
    added: [],
    removed: [],
    updated: [],
  };

  const repositoryEvidenceSummary = repositoryEvidenceFieldsFromAccounting(
    repositoryEvidenceAccounting,
    sourceFilesFetched,
  );

  const preparationSummary: ScanPreparationSummary = {
    changedPackageCount: changedPackages.length,
    lockfileDeltaAdded: delta.added.length,
    lockfileDeltaRemoved: delta.removed.length,
    lockfileDeltaUpdated: delta.updated.length,
    changedFileCount: changedFiles?.length ?? 0,
    sourceFilesFetched,
    ...repositoryEvidenceSummary,
    codeAnalysisEnabled: Boolean(
      codeAnalysis && codeAnalysis.fileContents.size > 0,
    ),
    warningCodes: warnings.map((w) => w.code),
  };

  return {
    scanRequest,
    codeAnalysis,
    warnings,
    preparationSummary,
  };
}

function defaultFetchTimeoutMs(): number {
  const raw = process.env.CODE_ANALYSIS_TIMEOUT_MS;
  const n = raw ? Number(raw) : 30_000;
  return Number.isFinite(n) && n > 0 ? n : 30_000;
}
