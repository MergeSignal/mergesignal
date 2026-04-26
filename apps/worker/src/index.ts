import "dotenv/config";
import { Worker } from "bullmq";
import { Pool } from "pg";
import { analyze } from "@mergesignal/engine";
import type { ScanQueueJob, ScanResult } from "@mergesignal/shared";
import { SCAN_QUEUE_NAME } from "@mergesignal/shared";
import { captureWorkerException, initWorkerSentry } from "./sentry.js";

initWorkerSentry();

const redisUrl = process.env.REDIS_URL;
const databaseUrl = process.env.DATABASE_URL;

if (!redisUrl || !databaseUrl) {
  console.error("REDIS_URL and DATABASE_URL are required");
  process.exit(1);
}

const connection = {
  url: redisUrl,
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
};

const pool = new Pool({ connectionString: databaseUrl });

async function persistSuccess(scanId: string, result: ScanResult) {
  const decision = result.decision?.recommendation ?? null;
  await pool.query(
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
      result_generated_at = NOW(),
      finished_at = NOW(),
      updated_at = NOW(),
      error = NULL
    WHERE id = $9`,
    [
      JSON.stringify(result),
      Math.round(result.totalScore),
      Math.round(result.layerScores.security),
      Math.round(result.layerScores.maintainability),
      Math.round(result.layerScores.ecosystem),
      Math.round(result.layerScores.upgradeImpact),
      result.methodologyVersion ?? null,
      decision,
      scanId,
    ],
  );
}

async function persistFailure(scanId: string, message: string) {
  await pool.query(
    `UPDATE scans SET
      status = 'failed',
      error = $2,
      finished_at = NOW(),
      updated_at = NOW()
    WHERE id = $1`,
    [scanId, message],
  );
}

async function markRunning(scanId: string, workerId: string) {
  await pool.query(
    `UPDATE scans SET
      status = 'running',
      worker_id = $2,
      started_at = COALESCE(started_at, NOW()),
      heartbeat_at = NOW(),
      updated_at = NOW()
    WHERE id = $1 AND status IN ('queued', 'running')`,
    [scanId, workerId],
  );
}

const workerId = `worker-${process.pid}`;

const worker = new Worker<ScanQueueJob>(
  SCAN_QUEUE_NAME,
  async (job) => {
    const {
      scanId,
      repoId,
      dependencyGraph,
      lockfile,
      repoSource,
      changedFiles,
    } = job.data;

    await markRunning(scanId, workerId);

    try {
      const result = await analyze({
        repoId,
        dependencyGraph: dependencyGraph ?? {},
        lockfile,
        repoSource,
        changedFiles,
      });

      await persistSuccess(scanId, result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      captureWorkerException(e);
      await persistFailure(scanId, msg);
      throw e;
    }
  },
  { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? "2") },
);

worker.on("failed", (job, err) => {
  console.error("Job failed", job?.id, err);
});

worker.on("completed", (job) => {
  console.info("Job completed", job.id);
});

console.info(
  `MergeSignal worker listening on queue "${SCAN_QUEUE_NAME}" (workerId=${workerId})`,
);

process.on("SIGTERM", async () => {
  await worker.close();
  await pool.end();
  process.exit(0);
});
