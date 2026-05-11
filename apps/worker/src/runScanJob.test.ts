import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import type { Pool } from "pg";
import type { ScanQueueJob } from "@mergesignal/shared";
import { executeScanJob } from "./runScanJob.js";

vi.mock("@mergesignal/engine", () => ({
  analyze: vi.fn(),
}));

vi.mock("./sentry.js", () => ({
  captureWorkerException: vi.fn(),
}));

import { analyze } from "@mergesignal/engine";

const validEngineOutput = {
  totalScore: 40,
  layerScores: {
    security: 10,
    maintainability: 10,
    ecosystem: 10,
    upgradeImpact: 10,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
  decision: {
    recommendation: "needs_review" as const,
    confidence: "medium" as const,
    reasoning: ["r1"],
  },
};

function makeJob(over: Partial<ScanQueueJob>): Job<ScanQueueJob> {
  const data: ScanQueueJob = {
    scanId: over.scanId ?? "scan-1",
    repoId: over.repoId ?? "acme/app",
    dependencyGraph: over.dependencyGraph ?? {},
    ...over,
  };
  return { id: data.scanId, data } as Job<ScanQueueJob>;
}

describe("executeScanJob", () => {
  beforeEach(() => {
    vi.mocked(analyze).mockReset();
  });

  it("persists a validated result on success and preserves PR columns in SQL", async () => {
    vi.mocked(analyze).mockResolvedValue(validEngineOutput);

    const calls: string[] = [];
    let status = "queued";

    const pool = {
      query: vi.fn(async (sql: string) => {
        calls.push(sql);
        if (sql.startsWith("SELECT status")) {
          return { rows: [{ status }], rowCount: 1 };
        }
        if (sql.includes("status IN ('queued', 'running')")) {
          status = "running";
          return { rowCount: 1 };
        }
        if (sql.includes("heartbeat_at = NOW()")) {
          return { rowCount: 1 };
        }
        if (sql.includes("status = 'done'")) {
          expect(sql).not.toMatch(/github_pr_number/i);
          status = "done";
          return { rowCount: 1 };
        }
        if (sql.includes("status = 'failed'")) {
          status = "failed";
          return { rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    await executeScanJob(
      pool,
      makeJob({
        baseLockfile: { manager: "pnpm", content: "x" },
        github: {
          owner: "acme",
          repo: "app",
          prNumber: 7,
          headSha: "head",
          baseSha: "base",
          baseRef: "main",
          installationId: 99,
        },
      }),
      "worker-test",
    );

    expect(analyze).toHaveBeenCalledTimes(1);
    const req = vi.mocked(analyze).mock.calls[0]![0];
    expect(req.baseLockfile).toEqual({ manager: "pnpm", content: "x" });
    expect(req.github).toEqual({ owner: "acme", repo: "app", prNumber: 7 });

    const doneSql = calls.find((c) => c.includes("status = 'done'"));
    expect(doneSql).toBeDefined();
  });

  it("marks failed on engine error and does not persist done", async () => {
    vi.mocked(analyze).mockRejectedValue(new Error("boom"));

    let status = "queued";
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith("SELECT status")) {
          return { rows: [{ status }], rowCount: 1 };
        }
        if (sql.includes("status IN ('queued', 'running')")) {
          status = "running";
          return { rowCount: 1 };
        }
        if (sql.includes("heartbeat_at = NOW()")) return { rowCount: 1 };
        if (sql.includes("status = 'failed'")) {
          status = "failed";
          return { rowCount: 1 };
        }
        if (sql.includes("status = 'done'")) {
          throw new Error("should not succeed");
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    await executeScanJob(pool, makeJob({}), "worker-test");
    expect(status).toBe("failed");
  });

  it("marks failed on invalid engine output", async () => {
    vi.mocked(analyze).mockResolvedValue({ not: "a scan" });

    let status = "queued";
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith("SELECT status")) {
          return { rows: [{ status }], rowCount: 1 };
        }
        if (sql.includes("status IN ('queued', 'running')")) {
          status = "running";
          return { rowCount: 1 };
        }
        if (sql.includes("heartbeat_at = NOW()")) return { rowCount: 1 };
        if (sql.includes("status = 'failed'")) {
          status = "failed";
          return { rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    await executeScanJob(pool, makeJob({}), "worker-test");
    expect(status).toBe("failed");
    const failCalls = vi
      .mocked(pool.query)
      .mock.calls.filter((c) => String(c[0]).includes("status = 'failed'"));
    expect(failCalls.length).toBeGreaterThanOrEqual(1);
    const err = String(failCalls[0]![1]?.[1] ?? "");
    expect(err.startsWith("validation:")).toBe(true);
  });

  it("skips analyze when scan is not runnable", async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith("SELECT status")) {
          return { rows: [{ status: "done" }], rowCount: 1 };
        }
        if (sql.includes("status IN ('queued', 'running')")) {
          return { rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    await executeScanJob(pool, makeJob({}), "worker-test");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("marks failed when persistSuccess fails after retries", async () => {
    vi.mocked(analyze).mockResolvedValue(validEngineOutput);

    let status = "queued";
    let doneAttempts = 0;
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith("SELECT status")) {
          return { rows: [{ status }], rowCount: 1 };
        }
        if (sql.includes("status IN ('queued', 'running')")) {
          status = "running";
          return { rowCount: 1 };
        }
        if (sql.includes("heartbeat_at = NOW()")) return { rowCount: 1 };
        if (sql.includes("status = 'done'")) {
          doneAttempts += 1;
          throw new Error("simulated db failure");
        }
        if (sql.includes("status = 'failed'")) {
          status = "failed";
          return { rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    await executeScanJob(pool, makeJob({}), "worker-test");
    expect(status).toBe("failed");
    expect(doneAttempts).toBeGreaterThanOrEqual(1);
  });
});
