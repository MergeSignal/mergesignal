import { randomUUID } from "crypto";
import { db } from "../db";
import { scanQueue } from "../queue";
import type { ScanLockfileInput } from "@reposentinel/shared";

export async function createScanAndEnqueue({
  scanId,
  repoId,
  dependencyGraph,
  lockfile,
  baseLockfile,
  github,
}: {
  scanId?: string;
  repoId: string;
  dependencyGraph: unknown;
  lockfile?: ScanLockfileInput;
  baseLockfile?: ScanLockfileInput;
  github?: {
    owner: string;
    repo: string;
    prNumber: number;
    headSha: string;
    baseSha?: string;
    installationId: number;
    deliveryId?: string;
  };
}) {
  const id = scanId ?? randomUUID();

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "INSERT INTO scans (id, repo_id, status) VALUES ($1, $2, 'queued') ON CONFLICT (id) DO NOTHING",
      [id, repoId],
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  try {
    await scanQueue.add(
      "scan",
      { scanId: id, repoId, dependencyGraph, lockfile, baseLockfile, github },
      {
        jobId: id,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (!msg.toLowerCase().includes("already exists")) {
      await db.query(
        "UPDATE scans SET status='failed', error=$2, finished_at=NOW(), updated_at=NOW() WHERE id=$1 AND status='queued'",
        [id, `enqueue_failed: ${msg}`],
      );
      throw e;
    }
  }

  return { scanId: id };
}

