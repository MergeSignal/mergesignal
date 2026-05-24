import "dotenv/config";
import { Worker } from "bullmq";
import { Pool } from "pg";
import type { ScanQueueJob } from "@mergesignal/shared";
import { SCAN_QUEUE_NAME } from "@mergesignal/shared";
import { captureWorkerException, initWorkerSentry } from "./sentry.js";
import { executeScanJob } from "./runScanJob.js";

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

const workerId = `worker-${process.pid}`;

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
  `MergeSignal worker listening on queue "${SCAN_QUEUE_NAME}" (workerId=${workerId})`,
);

process.on("SIGTERM", async () => {
  await worker.close();
  await pool.end();
  process.exit(0);
});
