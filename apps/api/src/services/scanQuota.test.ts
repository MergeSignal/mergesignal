import { describe, it, expect, vi, beforeEach } from "vitest";
import { ASSESSMENT_POSTURES } from "@mergesignal/shared";
import {
  entitlementPeriodBounds,
  EntitlementExhaustedError,
  getOwnerGithubQuotaStatus,
  LIVE_RESERVATION_STALE_MINUTES,
  reserveOwnerScan,
} from "./scanQuota.js";
import { getLimitsForOwner } from "./tier.js";

vi.mock("../db.js", () => ({
  db: { query: vi.fn() },
}));

vi.mock("./tier.js", () => ({
  getLimitsForOwner: vi.fn(),
}));

import { db } from "../db.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

type StoredScan = {
  owner: string;
  status: "queued" | "running" | "done" | "failed";
  posture: string | null;
  createdAt: Date;
  heartbeatAt: Date | null;
};

function limits(allowance: number, period: "week" | "month") {
  vi.mocked(getLimitsForOwner).mockReturnValue({
    scanMaxLockfileBytes: 1_000_000,
    scanAllowance: allowance,
    entitlementPeriod: period,
    prCommentsEnabled: false,
    alertsEnabled: false,
  });
}

function createSharedLedger(now: Date) {
  const scans: StoredScan[] = [];
  const tails = new Map<string, Promise<void>>();

  function acquire(owner: string): {
    acquired: Promise<void>;
    release: () => void;
  } {
    const previous = tails.get(owner) ?? Promise.resolve();
    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    tails.set(
      owner,
      previous.then(() => current),
    );
    return { acquired: previous, release };
  }

  function occupied(owner: string, params: unknown[]): number {
    const start = new Date(String(params[1])).getTime();
    const end = new Date(String(params[2])).getTime();
    const postures = params[3] as string[];
    const staleMinutes = Number(params[4]);
    const cutoff = now.getTime() - staleMinutes * MINUTE_MS;
    return scans.filter((scan) => {
      if (scan.owner !== owner) return false;
      const created = scan.createdAt.getTime();
      if (created < start || created >= end) return false;
      if (
        scan.status === "done" &&
        scan.posture &&
        postures.includes(scan.posture)
      ) {
        return true;
      }
      if (scan.status === "queued") return created >= cutoff;
      if (scan.status === "running") {
        return (scan.heartbeatAt ?? scan.createdAt).getTime() >= cutoff;
      }
      return false;
    }).length;
  }

  function client() {
    let release: (() => void) | null = null;
    let owner: string | null = null;
    return {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql === "BEGIN" || sql === "ROLLBACK") {
          if (sql === "ROLLBACK") release?.();
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("pg_advisory_xact_lock")) {
          owner = String(params?.[0]);
          const gate = acquire(owner);
          release = gate.release;
          await gate.acquired;
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes("COUNT(*)")) {
          return {
            rows: [{ c: occupied(owner ?? String(params?.[0]), params ?? []) }],
            rowCount: 1,
          };
        }
        if (sql.startsWith("INSERT")) {
          scans.push({
            owner: owner ?? "unknown",
            status: "queued",
            posture: null,
            createdAt: now,
            heartbeatAt: null,
          });
          return { rows: [], rowCount: 1 };
        }
        if (sql === "COMMIT") {
          release?.();
          release = null;
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
  }

  return { scans, client };
}

async function admit(
  client: {
    query: (
      sql: string,
      params?: unknown[],
    ) => Promise<{ rows: Array<{ c?: number }>; rowCount?: number | null }>;
  },
  owner: string,
  now: Date,
) {
  await client.query("BEGIN");
  await reserveOwnerScan(client, owner, now);
  await client.query("INSERT INTO scans (id) VALUES ($1)", ["scan"]);
  await client.query("COMMIT");
}

describe("entitlement periods", () => {
  it("uses the UTC week from Monday through the next Monday for free", () => {
    const sunday = new Date("2026-10-18T23:59:59.999Z");
    const bounds = entitlementPeriodBounds("week", sunday);
    expect(bounds.start.toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(bounds.resetsAt.toISOString()).toBe("2026-10-19T00:00:00.000Z");

    const monday = new Date("2026-10-19T00:00:00.000Z");
    const next = entitlementPeriodBounds("week", monday);
    expect(next.start.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(next.resetsAt.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(next.resetsAt.getTime() - next.start.getTime()).toBe(WEEK_MS);
  });

  it("uses the UTC calendar month for paid, including month and year boundaries", () => {
    const monthEnd = new Date("2026-01-31T23:00:00.000Z");
    const january = entitlementPeriodBounds("month", monthEnd);
    expect(january.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(january.resetsAt.toISOString()).toBe("2026-02-01T00:00:00.000Z");

    const yearEnd = new Date("2026-12-31T12:00:00.000Z");
    const december = entitlementPeriodBounds("month", yearEnd);
    expect(december.resetsAt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    const week = entitlementPeriodBounds("week", yearEnd);
    expect(week.start.toISOString()).toBe("2026-12-28T00:00:00.000Z");
    expect(week.resetsAt.toISOString()).toBe("2027-01-04T00:00:00.000Z");
  });
});

describe("owner entitlement occupancy", () => {
  const now = new Date("2026-10-19T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    limits(10, "week");
  });

  it("counts every authoritative posture and ignores failed or assessment-less scans", async () => {
    const ledger = createSharedLedger(now);
    const period = entitlementPeriodBounds("week", now);
    for (const posture of ASSESSMENT_POSTURES) {
      ledger.scans.push({
        owner: "acme",
        status: "done",
        posture,
        createdAt: now,
        heartbeatAt: null,
      });
    }
    ledger.scans.push(
      {
        owner: "acme",
        status: "failed",
        posture: "safe",
        createdAt: now,
        heartbeatAt: null,
      },
      {
        owner: "acme",
        status: "done",
        posture: null,
        createdAt: now,
        heartbeatAt: null,
      },
    );
    const client = ledger.client();
    await reserveOwnerScan(client, "acme", now);
    const countCall = client.query.mock.calls.find((call) =>
      String(call[0]).includes("COUNT(*)"),
    );
    expect(countCall?.[1]?.[3]).toEqual([...ASSESSMENT_POSTURES]);
    expect(String(countCall?.[0])).toContain(
      "result->'assessment'->>'posture'",
    );
    expect(String(countCall?.[0])).not.toContain("pr_risk");
    expect(String(countCall?.[0])).not.toContain("MIN(created_at)");
    expect(countCall?.[1]?.[1]).toBe(period.start.toISOString());
    expect(countCall?.[1]?.[2]).toBe(period.resetsAt.toISOString());
  });

  it("rejects the last slot when one live reservation occupies it and reports used 10", async () => {
    const ledger = createSharedLedger(now);
    for (let i = 0; i < 9; i += 1) {
      ledger.scans.push({
        owner: "acme",
        status: "done",
        posture: "safe",
        createdAt: now,
        heartbeatAt: null,
      });
    }
    ledger.scans.push({
      owner: "acme",
      status: "queued",
      posture: null,
      createdAt: now,
      heartbeatAt: null,
    });
    await expect(admit(ledger.client(), "acme", now)).rejects.toMatchObject({
      code: "entitlement_exhausted",
      limit: 10,
      used: 10,
      resetsAt: "2026-10-26T00:00:00.000Z",
      statusCode: 429,
    });
    expect(
      JSON.stringify(new EntitlementExhaustedError(10, 10, "x")),
    ).not.toContain("price");
  });

  it("releases capacity when the reservation fails and ignores a stale reservation", async () => {
    const ledger = createSharedLedger(now);
    const stale = new Date(
      now.getTime() - (LIVE_RESERVATION_STALE_MINUTES + 1) * MINUTE_MS,
    );
    for (let i = 0; i < 9; i += 1) {
      ledger.scans.push({
        owner: "acme",
        status: "done",
        posture: "needs_review",
        createdAt: now,
        heartbeatAt: null,
      });
    }
    const reservation: StoredScan = {
      owner: "acme",
      status: "queued",
      posture: null,
      createdAt: now,
      heartbeatAt: null,
    };
    ledger.scans.push(reservation);
    const held = ledger.client();
    await held.query("BEGIN");
    await expect(reserveOwnerScan(held, "acme", now)).rejects.toMatchObject({
      used: 10,
    });
    await held.query("ROLLBACK");
    reservation.status = "failed";
    await expect(admit(ledger.client(), "acme", now)).resolves.toBeUndefined();

    const another = createSharedLedger(now);
    for (let i = 0; i < 10; i += 1) {
      another.scans.push({
        owner: "acme",
        status: "queued",
        posture: null,
        createdAt: stale,
        heartbeatAt: null,
      });
    }
    await expect(
      reserveOwnerScan(another.client(), "acme", now),
    ).resolves.toBeUndefined();
  });

  it("admits only one of two racing requests for the final slot", async () => {
    const ledger = createSharedLedger(now);
    for (let i = 0; i < 9; i += 1) {
      ledger.scans.push({
        owner: "acme",
        status: "done",
        posture: "risky",
        createdAt: now,
        heartbeatAt: null,
      });
    }
    const results = await Promise.allSettled([
      admit(ledger.client(), "acme", now),
      admit(ledger.client(), "acme", now),
    ]);
    const admitted = results.filter((result) => result.status === "fulfilled");
    const refused = results.filter((result) => result.status === "rejected");
    expect(admitted).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({
        used: 10,
        code: "entitlement_exhausted",
      }),
    });
  });

  it("shares one owner allowance across repositories and keeps another owner separate", async () => {
    const ledger = createSharedLedger(now);
    for (let i = 0; i < 10; i += 1) {
      ledger.scans.push({
        owner: "acme",
        status: "done",
        posture: "indeterminate",
        createdAt: now,
        heartbeatAt: null,
      });
    }
    await expect(admit(ledger.client(), "acme", now)).rejects.toMatchObject({
      used: 10,
    });
    await expect(admit(ledger.client(), "beta", now)).resolves.toBeUndefined();
    const betaInsert = ledger.scans.filter((scan) => scan.owner === "beta");
    expect(betaInsert).toHaveLength(1);
  });
});

describe("getOwnerGithubQuotaStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports the shared owner period and reset, not a rolling daily window", async () => {
    limits(10, "week");
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ c: 10 }],
      rowCount: 1,
    } as never);
    const now = new Date("2026-10-18T23:00:00.000Z");
    const status = await getOwnerGithubQuotaStatus("acme", now);
    expect(status).toEqual({
      source: "github",
      state: "exceeded",
      limit: 10,
      used: 10,
      resetsAt: "2026-10-19T00:00:00.000Z",
    });
    const sql = String(vi.mocked(db.query).mock.calls[0]?.[0]);
    expect(sql).not.toContain("source='github'");
    expect(sql).not.toContain("INTERVAL '24 hours'");
    expect(sql).toContain("result->'assessment'->>'posture'");
  });

  it("does not mark an unlimited allowance exceeded", async () => {
    limits(-1, "month");
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ c: 999 }],
      rowCount: 1,
    } as never);
    const status = await getOwnerGithubQuotaStatus(
      "acme",
      new Date("2026-12-31T12:00:00.000Z"),
    );
    expect(status.state).toBe("ok");
    expect(status.limit).toBe(-1);
    expect(status.resetsAt).toBe("2027-01-01T00:00:00.000Z");
  });
});
