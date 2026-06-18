import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Job } from "bullmq";
import type { Pool } from "pg";
import type { ScanQueueJob } from "@mergesignal/shared";
import {
  withAssessmentScope,
  minimalReviewFocalPoint,
  emptyReachScope,
  emptyVerificationScope,
} from "@mergesignal/shared";
import { executeScanJob } from "./runScanJob.js";

vi.mock("@mergesignal/engine", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@mergesignal/engine")>();
  return {
    ...mod,
    analyze: vi.fn(),
    getEngineLoadInfo: vi.fn(() => ({
      spec: "file:/app/engine/dist/index.js",
      stub: false,
      releaseVersion: "v1.0.0",
      releaseRef: "v1.0.0",
      releaseGitSha: "abc123",
      methodologyVersion: "acme-prod/v1",
      loadedAt: "2026-01-01T00:00:00.000Z",
      loadDurationMs: 1,
      abiValidationDurationMs: 1,
    })),
  };
});

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
  methodologyVersion: "acme-prod/v1",
  assessment: withAssessmentScope(
    {
      posture: "needs_review" as const,
      confidence: "medium" as const,
      primaryConcern: null,
      concerns: [],
      factors: ["tooling_maintenance"],
      changeClasses: ["tooling_maintenance"],
      presentation: {
        narrativeIntensity: "standard" as const,
        reachVisibility: "hidden" as const,
        verificationIntensity: "advisory" as const,
        insightEmissionFloor: "none" as const,
        reportMode: "high_signal_pr" as const,
      },
    },
    {
      reviewFocalPoint: minimalReviewFocalPoint(["typescript"]),
      reachScope: emptyReachScope(),
      verificationScope: emptyVerificationScope(),
    },
  ),
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
  const originalEnv = process.env;

  beforeEach(() => {
    vi.mocked(analyze).mockReset();
    process.env = { ...originalEnv };
    delete process.env.MERGESIGNAL_TRUSTED_ANALYSIS;
    delete process.env.MERGESIGNAL_ALLOW_STUB;
  });

  afterEach(() => {
    process.env = originalEnv;
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
    expect(req.baseLockfile).toEqual({
      manager: "pnpm",
      content: "x",
    });
    expect(req.github).toEqual({ owner: "acme", repo: "app", prNumber: 7 });

    const doneSql = calls.find((c) => c.includes("status = 'done'"));
    expect(doneSql).toBeDefined();
    expect(doneSql).toMatch(/engine_release_version/);
    expect(doneSql).toMatch(/engine_release_git_sha/);
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

  it("when MERGESIGNAL_TRUSTED_ANALYSIS is set, fails if methodologyVersion is missing", async () => {
    process.env.MERGESIGNAL_TRUSTED_ANALYSIS = "1";
    vi.mocked(analyze).mockResolvedValue({
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
    });

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

  it("when MERGESIGNAL_TRUSTED_ANALYSIS is set, persists with valid provenance", async () => {
    process.env.MERGESIGNAL_TRUSTED_ANALYSIS = "1";
    vi.mocked(analyze).mockResolvedValue(validEngineOutput);

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
        if (sql.includes("status = 'done'")) {
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

    await executeScanJob(pool, makeJob({}), "worker-test");
    expect(status).toBe("done");
  });

  it("skips analyze when scan is already terminal", async () => {
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

  it("throws when scan row is missing or not runnable", async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith("SELECT status")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("status IN ('queued', 'running')")) {
          return { rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    await expect(
      executeScanJob(pool, makeJob({}), "worker-test"),
    ).rejects.toThrow("scan_not_runnable:scan-1:missing");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("completes scan when repoIntelligence contract is invalid but retains raw block", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.mocked(analyze).mockResolvedValue({
      ...validEngineOutput,
      repoIntelligence: {
        packageUsage: [{ name: "jsonwebtoken", files: ["src/a.ts"] }],
        blastRadius: { level: "large", factors: [] },
      },
    });

    let status = "queued";
    let persisted: Record<string, unknown> | undefined;

    const pool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.startsWith("SELECT status")) {
          return { rows: [{ status }], rowCount: 1 };
        }
        if (sql.includes("status IN ('queued', 'running')")) {
          status = "running";
          return { rowCount: 1 };
        }
        if (sql.includes("heartbeat_at = NOW()")) return { rowCount: 1 };
        if (sql.includes("status = 'done'")) {
          status = "done";
          persisted = JSON.parse(String(params?.[0])) as Record<
            string,
            unknown
          >;
          return { rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;

    await executeScanJob(
      pool,
      makeJob({
        github: {
          owner: "acme",
          repo: "app",
          prNumber: 26,
          headSha: "head",
          installationId: 1,
        },
      }),
      "worker-test",
    );

    expect(status).toBe("done");
    expect(persisted?.repoIntelligence).toBeDefined();
    const prep = persisted?.analysisPreparation as {
      repoIntelligenceValidation?: { status: string };
    };
    expect(prep.repoIntelligenceValidation?.status).toBe("invalid");

    const contractLog = warnSpy.mock.calls
      .map((c) => String(c[0]))
      .find((line) => line.includes("repo_intelligence_contract_failed"));
    expect(contractLog).toBeDefined();

    warnSpy.mockRestore();
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
