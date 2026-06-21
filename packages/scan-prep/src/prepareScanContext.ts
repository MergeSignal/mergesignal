import type {
  AnalysisContextWarning,
  CodeAnalysisInput,
  CodeAnalysisMetrics,
  ScanQueueJob,
  ScanRequest,
} from "@mergesignal/shared";

import { getCachedFiles, setCachedFiles } from "./file-cache.js";
import { classifyFetchError, fetchGitHubFiles } from "./github-files.js";
import {
  detectChangedPackages,
  detectLockfilePackageDelta,
  isPnpmLockfileDiffEmpty,
} from "./lockfile-diff.js";
import { logInfo, logWarn } from "./log.js";

export type PrepareScanContextResult = {
  scanRequest: ScanRequest;
  codeAnalysis?: CodeAnalysisInput;
  warnings: AnalysisContextWarning[];
  preparationSummary: ScanPreparationSummary;
};

export type ScanPreparationSummary = {
  changedPackageCount: number;
  lockfileDeltaAdded: number;
  lockfileDeltaRemoved: number;
  lockfileDeltaUpdated: number;
  changedFileCount: number;
  sourceFilesFetched: number;
  sourceFilesSkipped: number;
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

export async function prepareScanContext(
  job: ScanQueueJob,
): Promise<PrepareScanContextResult> {
  const warnings: AnalysisContextWarning[] = [];
  const { lockfile, baseLockfile, repoSource, changedFiles, github } = job;
  const lockfileDiffOptions =
    job.changedPackageJsonFiles && job.changedPackageJsonFiles.length > 0
      ? { changedPackageJsonFiles: job.changedPackageJsonFiles }
      : undefined;

  let changedPackages: string[] = [];
  let lockfilePackageDelta: ScanRequest["lockfilePackageDelta"] | undefined;

  if (lockfile && !baseLockfile && github) {
    warn(
      warnings,
      "base_lockfile_missing",
      "PR scan has head lockfile but no base lockfile for package diff",
      { repoId: job.repoId, pr: github.prNumber },
    );
  }

  if (baseLockfile && lockfile && baseLockfile.manager === lockfile.manager) {
    try {
      changedPackages = detectChangedPackages(
        baseLockfile.content,
        lockfile.content,
        lockfile.manager,
        lockfileDiffOptions,
      );
      lockfilePackageDelta = detectLockfilePackageDelta(
        baseLockfile.content,
        lockfile.content,
        lockfile.manager,
        lockfileDiffOptions,
      );

      const deltaEmpty =
        lockfile.manager === "pnpm"
          ? isPnpmLockfileDiffEmpty(
              baseLockfile.content,
              lockfile.content,
              lockfileDiffOptions,
            )
          : lockfilePackageDelta.added.length === 0 &&
            lockfilePackageDelta.removed.length === 0 &&
            lockfilePackageDelta.updated.length === 0;

      if (deltaEmpty && github) {
        warn(
          warnings,
          "lockfile_diff_empty",
          "Lockfile diff produced no package changes despite base and head lockfiles",
          { repoId: job.repoId, manager: lockfile.manager },
        );
      }
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
    }
  } else if (
    baseLockfile &&
    lockfile &&
    baseLockfile.manager !== lockfile.manager
  ) {
    warn(
      warnings,
      "lockfile_diff_skipped",
      "Base and head lockfile managers differ; skipping package diff",
      { base: baseLockfile.manager, head: lockfile.manager },
    );
  }

  let codeAnalysis: CodeAnalysisInput | undefined;
  const codeAnalysisMetrics: CodeAnalysisMetrics = {
    fromCache: false,
    filesAnalyzed: 0,
  };
  let sourceFilesFetched = 0;
  let sourceFilesSkipped = 0;

  if (repoSource && changedPackages.length > 0) {
    try {
      let fileContents: Map<string, string>;

      const cached = getCachedFiles(repoSource);
      if (cached) {
        fileContents = cached;
        codeAnalysisMetrics.fromCache = true;
        codeAnalysisMetrics.filesAnalyzed = cached.size;
        sourceFilesFetched = cached.size;
      } else {
        const fetchStart = Date.now();
        const fetchResult = await fetchGitHubFiles(repoSource, {
          timeoutMs: defaultFetchTimeoutMs(),
          maxFileSize: 500_000,
          maxFiles: 1000,
        });
        fileContents = fetchResult.files;
        sourceFilesSkipped = fetchResult.sourceFilesSkipped;
        codeAnalysisMetrics.analysisTimeMs = Date.now() - fetchStart;
        codeAnalysisMetrics.filesAnalyzed = fileContents.size;
        sourceFilesFetched = fileContents.size;

        let totalBytes = 0;
        for (const content of fileContents.values()) {
          totalBytes += Buffer.byteLength(content, "utf-8");
        }

        setCachedFiles(repoSource, fileContents, {
          fileCount: fileContents.size,
          totalBytes,
          fetchTimeMs: codeAnalysisMetrics.analysisTimeMs ?? 0,
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
    repoSource: job.repoSource,
    changedFiles,
    changedPackages,
    lockfilePackageDelta,
    codeAnalysisMetrics:
      codeAnalysisMetrics.filesAnalyzed > 0 ||
      warnings.some((w) => w.code.startsWith("code_"))
        ? codeAnalysisMetrics
        : undefined,
    github: github
      ? { owner: github.owner, repo: github.repo, prNumber: github.prNumber }
      : undefined,
  };

  const delta = lockfilePackageDelta ?? {
    added: [],
    removed: [],
    updated: [],
  };

  const preparationSummary: ScanPreparationSummary = {
    changedPackageCount: changedPackages.length,
    lockfileDeltaAdded: delta.added.length,
    lockfileDeltaRemoved: delta.removed.length,
    lockfileDeltaUpdated: delta.updated.length,
    changedFileCount: changedFiles?.length ?? 0,
    sourceFilesFetched,
    sourceFilesSkipped,
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
