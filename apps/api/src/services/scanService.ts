import { randomUUID } from "crypto";
import { db, queries } from "../db.js";
import { scanQueue } from "../queue.js";
import type {
  ScanLockfileInput,
  RepoSource,
  ScanQueueGithubContext,
} from "@mergesignal/shared";
import { getLimitsForOwner, getOwnerFromRepoId } from "./tier.js";
import { assertScanQuotaAvailable } from "./scanQuota.js";

export async function createScanAndEnqueue({
  scanId,
  repoId,
  dependencyGraph,
  lockfile,
  baseLockfile,
  changedFiles,
  github,
  source,
}: {
  scanId?: string;
  repoId: string;
  dependencyGraph: unknown;
  lockfile?: ScanLockfileInput;
  baseLockfile?: ScanLockfileInput;
  changedFiles?: string[];
  github?: ScanQueueGithubContext;
  source?: "manual" | "github";
}) {
  const id = scanId ?? randomUUID();
  const owner = getOwnerFromRepoId(repoId);
  const limits = getLimitsForOwner(owner);

  const lockfileBytes = lockfile?.content
    ? Buffer.byteLength(lockfile.content, "utf8")
    : 0;
  if (lockfileBytes > limits.scanMaxLockfileBytes) {
    throw Object.assign(new Error("lockfile too large"), { statusCode: 413 });
  }

  const isGithub = Boolean(github) || source === "github";
  await assertScanQuotaAvailable(owner, isGithub ? "github" : "manual");

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    if (scanId) {
      const existing = await client.query(
        "SELECT id, status FROM scans WHERE id = $1",
        [scanId],
      );
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
      github_pr_number: github?.prNumber ?? null,
      github_head_sha: github?.headSha ?? null,
      github_base_ref: github?.baseRef ?? null,
      github_base_sha: github?.baseSha ?? null,
    });

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  // Build repoSource if we have GitHub context
  const repoSource: RepoSource | undefined = github
    ? {
        provider: "github" as const,
        owner: github.owner,
        repo: github.repo,
        sha: github.headSha,
        installationId: github.installationId,
      }
    : undefined;

  try {
    await scanQueue.add(
      "scan",
      {
        scanId: id,
        repoId,
        dependencyGraph,
        lockfile,
        baseLockfile,
        repoSource,
        changedFiles,
        github,
      },
      {
        jobId: id,
        // Single attempt: worker marks terminal `failed`/`done` in DB; BullMQ
        // retries would re-run the engine and could overwrite a failed scan.
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    console.info(
      JSON.stringify({
        msg: "scan_enqueued",
        scanId: id,
        repoId,
        source: isGithub ? "github" : "manual",
        prNumber: github?.prNumber ?? null,
      }),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
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
