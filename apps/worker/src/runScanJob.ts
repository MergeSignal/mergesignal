import type { Job } from "bullmq";
import type { Pool } from "pg";
import {
  analyze,
  getEngineLoadInfo,
  requiresStrictEngineScanValidation,
} from "@mergesignal/engine";
import { prepareScanContext } from "@mergesignal/scan-prep";
import type {
  AnalysisPreparation,
  ScanQueueJob,
  ScanResult,
} from "@mergesignal/shared";
import {
  applyRepoIntelligenceValidation,
  parseScanResultOrThrow,
  validateTrustedEngineScanResult,
} from "@mergesignal/shared";
import { withPgRetries } from "./pgRetry.js";
import { captureWorkerException } from "./sentry.js";

function logScanEvent(
  level: "info" | "warn" | "error",
  msg: string,
  fields: Record<string, unknown>,
): void {
  const line = JSON.stringify({ msg, ...fields });
  if (level === "info") console.info(line);
  else if (level === "warn") console.warn(line);
  else console.error(line);
}

function truncateErrorMessage(raw: string, max = 8000): string {
  if (raw.length <= max) return raw;
  return raw.slice(0, max - 20) + "…(truncated)";
}

function mergeAnalysisPreparation(
  result: ScanResult,
  warnings: AnalysisPreparation["warnings"],
  codeIntelligenceAvailable: boolean,
): ScanResult {
  const analysisPreparation: AnalysisPreparation = {
    codeIntelligenceAvailable,
    warnings,
  };
  return { ...result, analysisPreparation };
}

async function markRunning(
  pool: Pool,
  scanId: string,
  workerId: string,
): Promise<number> {
  const res = await withPgRetries(() =>
    pool.query(
      `UPDATE scans SET
        status = 'running',
        worker_id = $2,
        started_at = COALESCE(started_at, NOW()),
        heartbeat_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND status IN ('queued', 'running')`,
      [scanId, workerId],
    ),
  );
  return res.rowCount ?? 0;
}

async function touchHeartbeat(pool: Pool, scanId: string): Promise<void> {
  await withPgRetries(() =>
    pool.query(
      `UPDATE scans SET heartbeat_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'running'`,
      [scanId],
    ),
  );
}

async function persistSuccess(
  pool: Pool,
  scanId: string,
  result: ScanResult,
  engineReleaseVersion: string | null,
  engineReleaseGitSha: string | null,
): Promise<number> {
  const decision = result.decision?.recommendation ?? null;
  const res = await withPgRetries(() =>
    pool.query(
      `UPDATE scans SET
        status = 'done',
        result = $1::jsonb,
        total_score = $2,
        layer_security = $3,
        layer_maintainability = $4,
        layer_ecosystem = $5,
        layer_upgrade_impact = $6,
        methodology_version = $7,
        decision = $8,
        engine_release_version = $9,
        engine_release_git_sha = $10,
        result_generated_at = NOW(),
        finished_at = NOW(),
        updated_at = NOW(),
        error = NULL
      WHERE id = $11 AND status = 'running'`,
      [
        JSON.stringify(result),
        Math.round(result.totalScore),
        Math.round(result.layerScores.security),
        Math.round(result.layerScores.maintainability),
        Math.round(result.layerScores.ecosystem),
        Math.round(result.layerScores.upgradeImpact),
        result.methodologyVersion ?? null,
        decision,
        engineReleaseVersion,
        engineReleaseGitSha,
        scanId,
      ],
    ),
  );
  return res.rowCount ?? 0;
}

async function persistFailure(
  pool: Pool,
  scanId: string,
  message: string,
): Promise<number> {
  const res = await withPgRetries(() =>
    pool.query(
      `UPDATE scans SET
        status = 'failed',
        error = $2,
        finished_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND status = 'running'`,
      [scanId, truncateErrorMessage(message)],
    ),
  );
  return res.rowCount ?? 0;
}

async function getScanStatus(
  pool: Pool,
  scanId: string,
): Promise<string | null> {
  const { rows } = await pool.query<{ status: string }>(
    "SELECT status::text AS status FROM scans WHERE id=$1",
    [scanId],
  );
  return rows[0]?.status ?? null;
}

/**
 * Processes a single scan job. Does not rethrow: terminal failures are stored on the scan row
 * so BullMQ does not retry into an inconsistent `failed` → `done` transition.
 */
export async function executeScanJob(
  pool: Pool,
  job: Job<ScanQueueJob>,
  workerId: string,
): Promise<void> {
  const { scanId, repoId, github } = job.data;

  const jobId = String(job.id ?? scanId);
  const pr = github?.prNumber ?? null;

  logScanEvent("info", "scan_job_start", {
    scanId,
    repoId,
    jobId,
    pr,
    workerId,
  });

  let hb: ReturnType<typeof setInterval> | undefined;
  const hbMs = Number(process.env.SCAN_HEARTBEAT_INTERVAL_MS ?? "30000");
  try {
    const marked = await markRunning(pool, scanId, workerId);
    if (marked === 0) {
      const status = await getScanStatus(pool, scanId);
      if (status === "done" || status === "failed") {
        logScanEvent("info", "scan_job_skip_terminal", {
          scanId,
          repoId,
          jobId,
          pr,
          status,
        });
        return;
      }
      const detail = status ?? "missing";
      logScanEvent("error", "scan_job_not_runnable", {
        scanId,
        repoId,
        jobId,
        pr,
        status: detail,
      });
      throw new Error(`scan_not_runnable:${scanId}:${detail}`);
    }

    if (hbMs > 0 && Number.isFinite(hbMs)) {
      hb = setInterval(() => {
        touchHeartbeat(pool, scanId).catch((e) => {
          logScanEvent("warn", "scan_heartbeat_failed", {
            scanId,
            repoId,
            jobId,
            pr,
            err: e instanceof Error ? e.message : String(e),
          });
        });
      }, hbMs);
    }

    const prepared = await prepareScanContext(job.data);
    const engineInfo = getEngineLoadInfo();

    for (const w of prepared.warnings) {
      logScanEvent("warn", "scan_context_warning", {
        scanId,
        repoId,
        jobId,
        pr,
        code: w.code,
        message: w.message,
        details: w.details,
      });
    }

    logScanEvent("info", "scan_context_prepared", {
      scanId,
      repoId,
      jobId,
      pr,
      ...prepared.preparationSummary,
      engineReleaseVersion:
        engineInfo?.releaseVersion ?? engineInfo?.releaseRef ?? null,
      methodologyVersion: engineInfo?.methodologyVersion ?? null,
    });

    let rawResult: unknown;
    const engineStarted = Date.now();
    logScanEvent("info", "engine_execution_start", {
      scanId,
      repoId,
      jobId,
      pr,
      codeAnalysisEnabled: prepared.preparationSummary.codeAnalysisEnabled,
    });
    try {
      rawResult = await analyze(prepared.scanRequest, prepared.codeAnalysis);
    } catch (e: unknown) {
      captureWorkerException(e);
      const msg = e instanceof Error ? e.message : String(e);
      const n = await persistFailure(pool, scanId, `engine: ${msg}`);
      logScanEvent("error", "scan_job_engine_failed", {
        scanId,
        repoId,
        jobId,
        pr,
        rowsUpdated: n,
        durationMs: Date.now() - engineStarted,
        err: msg,
      });
      return;
    }

    const engineDurationMs = Date.now() - engineStarted;
    const methodologyVersion =
      rawResult &&
      typeof rawResult === "object" &&
      "methodologyVersion" in rawResult
        ? String(
            (rawResult as { methodologyVersion?: unknown })
              .methodologyVersion ?? "",
          )
        : undefined;
    logScanEvent("info", "engine_execution_done", {
      scanId,
      repoId,
      jobId,
      pr,
      durationMs: engineDurationMs,
      methodologyVersion,
    });

    let validated: ScanResult;
    try {
      validated = requiresStrictEngineScanValidation()
        ? validateTrustedEngineScanResult(rawResult)
        : parseScanResultOrThrow(rawResult);
    } catch (e: unknown) {
      captureWorkerException(e);
      const msg = e instanceof Error ? e.message : String(e);
      const n = await persistFailure(pool, scanId, truncateErrorMessage(msg));
      logScanEvent("error", "scan_job_validation_failed", {
        scanId,
        repoId,
        jobId,
        pr,
        rowsUpdated: n,
      });
      return;
    }

    const codeIntelligenceAvailable =
      prepared.preparationSummary.codeAnalysisEnabled &&
      Boolean(prepared.codeAnalysis?.fileContents.size);
    const withPreparation = mergeAnalysisPreparation(
      validated,
      prepared.warnings,
      codeIntelligenceAvailable,
    );
    const {
      result: resultToStore,
      contractFailed,
      logPayload,
    } = applyRepoIntelligenceValidation(withPreparation);

    if (contractFailed && logPayload) {
      logScanEvent("warn", "repo_intelligence_contract_failed", {
        scanId,
        repoId,
        jobId,
        pr,
        prNumber: job.data.github?.prNumber ?? null,
        methodologyVersion: logPayload.methodologyVersion ?? null,
        issueCount: logPayload.issueCount,
        representativeIssues: logPayload.representativeIssues,
        packageCount: logPayload.packageCount,
        codeIntelligenceAvailable,
      });
    }

    try {
      const n = await persistSuccess(
        pool,
        scanId,
        resultToStore,
        engineInfo?.releaseVersion ?? engineInfo?.releaseRef ?? null,
        engineInfo?.releaseGitSha ?? null,
      );
      if (n === 0) {
        logScanEvent("warn", "scan_persist_done_no_row", {
          scanId,
          repoId,
          jobId,
          pr,
        });
      } else {
        logScanEvent("info", "scan_job_done", {
          scanId,
          repoId,
          jobId,
          pr,
          engineReleaseVersion:
            engineInfo?.releaseVersion ?? engineInfo?.releaseRef ?? null,
          engineReleaseGitSha: engineInfo?.releaseGitSha ?? null,
          methodologyVersion: validated.methodologyVersion,
          totalScore: validated.totalScore,
          decision: validated.decision?.recommendation ?? null,
          codeIntelligenceAvailable,
          warningCodes: prepared.preparationSummary.warningCodes,
        });
      }
    } catch (e: unknown) {
      captureWorkerException(e);
      const msg = e instanceof Error ? e.message : String(e);
      const n = await persistFailure(pool, scanId, `db: ${msg}`);
      logScanEvent("error", "scan_job_persist_failed", {
        scanId,
        repoId,
        jobId,
        pr,
        rowsUpdated: n,
      });
    }
  } finally {
    if (hb) clearInterval(hb);
  }
}
