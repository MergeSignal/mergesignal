import { describe, it, expect, vi, beforeEach } from "vitest";
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

vi.mock("./githubSurfaces.js", () => ({
  publishGitHubCheckRun: vi.fn(),
}));

vi.mock("./sentry.js", () => ({
  captureWorkerException: vi.fn(),
}));

import { analyze } from "@mergesignal/engine";
import { publishGitHubCheckRun } from "./githubSurfaces.js";

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

const githubContext = {
  owner: "acme",
  repo: "app",
  prNumber: 42,
  headSha: "deadbeef",
  installationId: 99,
};

function makeJob(overrides: Partial<ScanQueueJob> = {}): Job<ScanQueueJob> {
  const data: ScanQueueJob = {
    scanId: "scan-binding-1",
    repoId: "acme/app",
    dependencyGraph: {},
    github: githubContext,
    ...overrides,
  };
  return { id: data.scanId, data } as Job<ScanQueueJob>;
}

function makePool(onQuery?: (sql: string, params?: unknown[]) => void): Pool {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      onQuery?.(sql, params);
      if (sql.includes("status = 'running'") && sql.includes("UPDATE scans")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes("status = 'done'") && sql.includes("result = $1")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes("github_surfaces_published_at = NOW()")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("SELECT status")) {
        return { rows: [{ status: "queued" }], rowCount: 1 };
      }
      return { rowCount: 1, rows: [] };
    }),
  } as unknown as Pool;
}

describe("scan surface binding", () => {
  beforeEach(() => {
    vi.mocked(analyze).mockReset();
    vi.mocked(publishGitHubCheckRun).mockReset();
    process.env.GITHUB_APP_ID = "1";
    process.env.GITHUB_PRIVATE_KEY = "fake";
  });

  it("uses the same scanId for persist and Check Run publish; sets surfaced_at on success", async () => {
    vi.mocked(analyze).mockResolvedValue(validEngineOutput);
    vi.mocked(publishGitHubCheckRun).mockResolvedValue(undefined);

    let surfacedUpdate: unknown[] | null = null;
    const pool = makePool((sql, params) => {
      if (sql.includes("github_surfaces_published_at = NOW()")) {
        surfacedUpdate = params ?? null;
      }
    });

    await executeScanJob(pool, makeJob(), "worker-1");

    expect(publishGitHubCheckRun).toHaveBeenCalledWith(
      githubContext,
      "scan-binding-1",
      expect.objectContaining({
        decision: expect.objectContaining({ recommendation: "needs_review" }),
      }),
    );
    expect(surfacedUpdate).toEqual(["scan-binding-1"]);
  });

  it("leaves surfaced_at unset when publish fails", async () => {
    vi.mocked(analyze).mockResolvedValue(validEngineOutput);
    vi.mocked(publishGitHubCheckRun).mockRejectedValue(
      new Error("checks.create failed"),
    );

    const sqlCalls: string[] = [];
    const pool = {
      query: vi.fn(async (sql: string) => {
        sqlCalls.push(sql);
        if (sql.includes("status = 'running'"))
          return { rowCount: 1, rows: [] };
        if (sql.includes("status = 'done'")) return { rowCount: 1, rows: [] };
        if (sql.startsWith("SELECT status")) {
          return { rows: [{ status: "queued" }], rowCount: 1 };
        }
        return { rowCount: 1, rows: [] };
      }),
    } as unknown as Pool;

    await executeScanJob(pool, makeJob(), "worker-1");

    expect(
      sqlCalls.some((s) => s.includes("github_surfaces_published_at = NOW()")),
    ).toBe(false);
    expect(
      sqlCalls.some((s) => s.includes("github_surfaces_publish_error")),
    ).toBe(true);
  });

  it("skips publish when job has no github context", async () => {
    vi.mocked(analyze).mockResolvedValue(validEngineOutput);

    const sqlCalls: string[] = [];
    const pool = makePool((sql) => {
      sqlCalls.push(sql);
    });

    await executeScanJob(pool, makeJob({ github: undefined }), "worker-1");

    expect(publishGitHubCheckRun).not.toHaveBeenCalled();
    expect(
      sqlCalls.some((s) => s.includes("github_surfaces_published_at = NOW()")),
    ).toBe(false);
  });
});
