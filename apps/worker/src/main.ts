import "dotenv/config";
import { Worker } from "bullmq";
import { Pool } from "pg";
import type { ScanQueueJob } from "@mergesignal/shared";
import { SCAN_QUEUE_NAME } from "@mergesignal/shared";
import { captureWorkerException, initWorkerSentry } from "./sentry.js";
import { executeScanJob } from "./runScanJob.js";
import { logWorkerStartupComplete, runEngineStartup } from "./engineStartup.js";

function validateInfraEnv(): { redisUrl: string; databaseUrl: string } {
  const redisUrl = process.env.REDIS_URL;
  const databaseUrl = process.env.DATABASE_URL;

  if (!redisUrl || !databaseUrl) {
    console.error(
      JSON.stringify({
        msg: "worker_startup_failed",
        reason: "missing_infra_env",
        err: "REDIS_URL and DATABASE_URL are required",
      }),
    );
    process.exit(1);
  }

  return { redisUrl, databaseUrl };
}

async function main(): Promise<void> {
  initWorkerSentry();

  const bootStart = Date.now();
  const { redisUrl, databaseUrl } = validateInfraEnv();

  let engineInfo;
  try {
    engineInfo = await runEngineStartup();
  } catch {
    process.exit(1);
  }

  const workerId = `worker-${process.pid}`;
  logWorkerStartupComplete(engineInfo, Date.now() - bootStart, workerId);

  const connection = {
    url: redisUrl,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
  };

  const pool = new Pool({ connectionString: databaseUrl });

  const worker = new Worker<ScanQueueJob>(
    SCAN_QUEUE_NAME,
    async (job) => {
      try {
        await executeScanJob(pool, job, workerId);
      } catch (e: unknown) {
        captureWorkerException(e);
        console.error(
          JSON.stringify({
            msg: "scan_job_unexpected_error",
            scanId: job.data?.scanId,
            repoId: job.data?.repoId,
            jobId: String(job.id ?? ""),
            err: e instanceof Error ? e.message : String(e),
          }),
        );
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
    JSON.stringify({
      msg: "worker_queue_consumer_started",
      workerId,
      queue: SCAN_QUEUE_NAME,
    }),
  );

  process.on("SIGTERM", async () => {
    await worker.close();
    await pool.end();
    process.exit(0);
  });
}

main().catch((e: unknown) => {
  captureWorkerException(e);
  console.error(
    JSON.stringify({
      msg: "worker_startup_failed",
      reason: "unhandled_main_error",
      err: e instanceof Error ? e.message : String(e),
    }),
  );
  process.exit(1);
});
