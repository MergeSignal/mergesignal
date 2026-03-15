import { randomUUID } from "crypto";
import { db, queries } from "../db.js";
import { scanQueue } from "../queue.js";
import type { ScanLockfileInput } from "@reposentinel/shared";
import { getLimitsForOwner, getOwnerFromRepoId } from "./tier.js";

export async function createScanAndEnqueue({
  scanId,
  repoId,
  dependencyGraph,
  lockfile,
  baseLockfile,
  github,
  source,
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
  source?: "manual" | "github";
}) {
  const id = scanId ?? randomUUID();
  const owner = getOwnerFromRepoId(repoId);
  const limits = getLimitsForOwner(owner);

  const lockfileBytes = lockfile?.content ? Buffer.byteLength(lockfile.content, "utf8") : 0;
  if (lockfileBytes > limits.scanMaxLockfileBytes) {
    const err: any = new Error("lockfile too large");
    err.statusCode = 413;
    throw err;
  }

  const scansPerDay = limits.scansPerOwnerPerDay;
  const githubScansPerDay = limits.githubScansPerOwnerPerDay;
  const isGithub = Boolean(github) || source === "github";
  const limit = isGithub ? githubScansPerDay : scansPerDay;

  if (limit >= 0) {
    const { rows } = isGithub
      ? await db.query(
          "SELECT COUNT(*)::int AS c FROM scans WHERE split_part(repo_id,'/',1)=$1 AND source='github' AND created_at > NOW() - INTERVAL '24 hours'",
          [owner],
        )
      : await db.query(
          "SELECT COUNT(*)::int AS c FROM scans WHERE split_part(repo_id,'/',1)=$1 AND created_at > NOW() - INTERVAL '24 hours'",
          [owner],
        );
    const c = Number(rows?.[0]?.c ?? 0);
    if (c >= limit) {
      const err: any = new Error("scan quota exceeded");
      err.statusCode = 429;
      err.expose = true;
      throw err;
    }
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    if (scanId) {
      const existing = await client.query("SELECT id, status FROM scans WHERE id = $1", [scanId]);
      if (existing.rowCount && existing.rowCount > 0) {
        const status = existing.rows[0].status;
        await client.query("ROLLBACK");
        return { scanId, duplicate: true, status };
      }
    }

    await queries.scans.create({
      id,
      repo_id: repoId,
      status: "queued",
      source: isGithub ? "github" : "manual",
    });

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
    if (msg.toLowerCase().includes("already exists")) {
      return { scanId: id, duplicate: true };
    }
    await db.query(
      "UPDATE scans SET status='failed', error=$2, finished_at=NOW(), updated_at=NOW() WHERE id=$1 AND status='queued'",
      [id, `enqueue_failed: ${msg}`],
    );
    throw e;
  }

  return { scanId: id };
}

