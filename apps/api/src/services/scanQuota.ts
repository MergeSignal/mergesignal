import { ASSESSMENT_POSTURES } from "@mergesignal/shared";
import { db } from "../db.js";
import { getLimitsForOwner, type EntitlementPeriod } from "./tier.js";

/** Default stale-scan sweep bound. A reservation older than this does not occupy a slot. */
export const LIVE_RESERVATION_STALE_MINUTES = 30;

export type OwnerGithubQuotaStatus = {
  source: "github";
  state: "ok" | "exceeded";
  limit: number;
  used: number;
  resetsAt: string;
};

export type EntitlementPeriodBounds = {
  start: Date;
  resetsAt: Date;
};

type SqlClient = {
  query: (
    sql: string,
    values?: unknown[],
  ) => Promise<{ rows: Array<{ c?: number }>; rowCount?: number | null }>;
};

const OCCUPANCY_SQL = `
  SELECT COUNT(*)::int AS c
  FROM scans
  WHERE split_part(repo_id, '/', 1) = $1
    AND created_at >= $2
    AND created_at < $3
    AND (
      (
        status = 'done'
        AND jsonb_typeof(result->'assessment') = 'object'
        AND result->'assessment'->>'posture' = ANY($4::text[])
      )
      OR (
        status = 'queued'
        AND created_at >= NOW() - ($5::int * INTERVAL '1 minute')
      )
      OR (
        status = 'running'
        AND COALESCE(heartbeat_at, created_at) >= NOW() - ($5::int * INTERVAL '1 minute')
      )
    )
`;

export class EntitlementExhaustedError extends Error {
  readonly statusCode = 429 as const;
  readonly expose = true as const;
  readonly code = "entitlement_exhausted" as const;

  constructor(
    readonly limit: number,
    readonly used: number,
    readonly resetsAt: string,
  ) {
    super("Scan allowance is exhausted.");
  }
}

/** Fixed UTC period. Week starts Monday 00:00. Month starts the 1st at 00:00. */
export function entitlementPeriodBounds(
  period: EntitlementPeriod,
  now: Date,
): EntitlementPeriodBounds {
  if (period === "week") {
    const start = startOfUtcIsoWeek(now);
    return {
      start,
      resetsAt: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000),
    };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    start,
    resetsAt: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    ),
  };
}

/**
 * Serialize admission for this owner, then refuse when completed Assessments
 * plus live reservations already fill the period allowance.
 * `used` is that occupied count, not completed usage alone.
 */
export async function reserveOwnerScan(
  client: SqlClient,
  owner: string,
  now = new Date(),
): Promise<void> {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))",
    [owner],
  );
  const limits = getLimitsForOwner(owner);
  if (limits.scanAllowance < 0) return;

  const period = entitlementPeriodBounds(limits.entitlementPeriod, now);
  const used = await countOccupied(client, owner, period);
  if (used >= limits.scanAllowance) {
    throw new EntitlementExhaustedError(
      limits.scanAllowance,
      used,
      period.resetsAt.toISOString(),
    );
  }
}

export async function getOwnerGithubQuotaStatus(
  owner: string,
  now = new Date(),
): Promise<OwnerGithubQuotaStatus> {
  const limits = getLimitsForOwner(owner);
  const period = entitlementPeriodBounds(limits.entitlementPeriod, now);
  const used = await countOccupied(db, owner, period);
  const exceeded = limits.scanAllowance >= 0 && used >= limits.scanAllowance;
  return {
    source: "github",
    state: exceeded ? "exceeded" : "ok",
    limit: limits.scanAllowance,
    used,
    resetsAt: period.resetsAt.toISOString(),
  };
}

async function countOccupied(
  client: SqlClient,
  owner: string,
  period: EntitlementPeriodBounds,
): Promise<number> {
  const { rows } = await client.query(OCCUPANCY_SQL, [
    owner,
    period.start.toISOString(),
    period.resetsAt.toISOString(),
    [...ASSESSMENT_POSTURES],
    LIVE_RESERVATION_STALE_MINUTES,
  ]);
  return Number(rows?.[0]?.c ?? 0);
}

function startOfUtcIsoWeek(now: Date): Date {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const daysFromMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysFromMonday);
  return start;
}
