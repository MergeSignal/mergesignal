import { db } from "../db.js";
import { getLimitsForOwner } from "./tier.js";

export const GITHUB_SCAN_QUOTA_WINDOW_HOURS = 24;

const WINDOW_INTERVAL = `INTERVAL '${GITHUB_SCAN_QUOTA_WINDOW_HOURS} hours'`;

export type OwnerGithubQuotaStatus = {
  source: "github";
  state: "ok" | "exceeded";
  limit: number;
  used: number;
  windowHours: number;
  resetsAt?: string;
};

export type ScanQuotaScope = "github" | "all";

export async function countOwnerScansInWindow(
  owner: string,
  scope: ScanQuotaScope,
): Promise<number> {
  const sql =
    scope === "github"
      ? `SELECT COUNT(*)::int AS c FROM scans WHERE split_part(repo_id,'/',1)=$1 AND source='github' AND created_at > NOW() - ${WINDOW_INTERVAL}`
      : `SELECT COUNT(*)::int AS c FROM scans WHERE split_part(repo_id,'/',1)=$1 AND created_at > NOW() - ${WINDOW_INTERVAL}`;
  const { rows } = await db.query<{ c: number }>(sql, [owner]);
  return Number(rows?.[0]?.c ?? 0);
}

async function oldestGithubScanCreatedAt(owner: string): Promise<Date | null> {
  const { rows } = await db.query<{ created_at: Date }>(
    `SELECT MIN(created_at) AS created_at FROM scans WHERE split_part(repo_id,'/',1)=$1 AND source='github' AND created_at > NOW() - ${WINDOW_INTERVAL}`,
    [owner],
  );
  const raw = rows?.[0]?.created_at;
  if (!raw) return null;
  return raw instanceof Date ? raw : new Date(raw);
}

function computeResetsAt(oldest: Date | null): string | undefined {
  if (!oldest) return undefined;
  const ms = oldest.getTime() + GITHUB_SCAN_QUOTA_WINDOW_HOURS * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export async function getOwnerGithubQuotaStatus(
  owner: string,
): Promise<OwnerGithubQuotaStatus> {
  const limit = getLimitsForOwner(owner).githubScansPerOwnerPerDay;
  const used = await countOwnerScansInWindow(owner, "github");
  const windowHours = GITHUB_SCAN_QUOTA_WINDOW_HOURS;

  if (limit < 0) {
    return { source: "github", state: "ok", limit, used, windowHours };
  }

  const exceeded = used >= limit;
  const state = exceeded ? "exceeded" : "ok";
  const resetsAt = exceeded
    ? computeResetsAt(await oldestGithubScanCreatedAt(owner))
    : undefined;

  return {
    source: "github",
    state,
    limit,
    used,
    windowHours,
    ...(resetsAt ? { resetsAt } : {}),
  };
}

export async function assertScanQuotaAvailable(
  owner: string,
  source: "github" | "manual",
): Promise<void> {
  const limits = getLimitsForOwner(owner);
  const isGithub = source === "github";
  const limit = isGithub
    ? limits.githubScansPerOwnerPerDay
    : limits.scansPerOwnerPerDay;

  if (limit < 0) return;

  const used = await countOwnerScansInWindow(
    owner,
    isGithub ? "github" : "all",
  );
  if (used >= limit) {
    throw Object.assign(new Error("scan quota exceeded"), {
      statusCode: 429,
      expose: true,
    });
  }
}
