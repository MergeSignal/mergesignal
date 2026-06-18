import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScanQueueJob } from "@mergesignal/shared";
import { prepareScanContext } from "@mergesignal/scan-prep";
import { __resetEngineLoaderCacheForTests } from "@mergesignal/engine";
import { executeScanJob } from "./runScanJob.js";
import type { Job } from "bullmq";
import type { Pool } from "pg";

vi.mock("@mergesignal/scan-prep", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@mergesignal/scan-prep")>();
  return { ...actual };
});

vi.mock("./sentry.js", () => ({
  captureWorkerException: vi.fn(),
}));

const pnpmBase = `
lockfileVersion: '9.0'
packages:
  react@17.0.2:
    resolution: {integrity: sha512-test}
`;

const pnpmHead = `
lockfileVersion: '9.0'
packages:
  react@18.2.0:
    resolution: {integrity: sha512-test2}
`;

describe("worker → engine scan contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetEngineLoaderCacheForTests();
    process.env.MERGESIGNAL_ENGINE_IMPL = "@mergesignal/engine-test-fixture";
    process.env.NODE_ENV = "test";
    delete process.env.MERGESIGNAL_ALLOW_STUB;
  });

  it("passes changedPackages, lockfilePackageDelta, and codeAnalysis to analyze()", async () => {
    const analyzeSpy = vi.spyOn(await import("@mergesignal/engine"), "analyze");

    const job: ScanQueueJob = {
      scanId: "contract-1",
      repoId: "acme/app",
      dependencyGraph: {},
      lockfile: { manager: "pnpm", content: pnpmHead },
      baseLockfile: { manager: "pnpm", content: pnpmBase },
      repoSource: {
        provider: "github",
        owner: "acme",
        repo: "app",
        sha: "abc123",
        installationId: 1,
      },
      github: {
        owner: "acme",
        repo: "app",
        prNumber: 1,
        headSha: "abc123",
        installationId: 1,
      },
    };

    const corpus = new Map([["src/index.ts", "import react from 'react';"]]);
    vi.spyOn(
      await import("@mergesignal/scan-prep"),
      "prepareScanContext",
    ).mockResolvedValue({
      scanRequest: {
        repoId: job.repoId,
        dependencyGraph: {},
        lockfile: job.lockfile,
        baseLockfile: job.baseLockfile,
        repoSource: job.repoSource,
        changedPackages: ["react"],
        lockfilePackageDelta: {
          added: [],
          removed: [],
          updated: ["react"],
        },
        github: { owner: "acme", repo: "app", prNumber: 1 },
      },
      codeAnalysis: {
        fileContents: corpus,
        changedPackages: ["react"],
      },
      warnings: [],
      preparationSummary: {
        changedPackageCount: 1,
        lockfileDeltaAdded: 0,
        lockfileDeltaRemoved: 0,
        lockfileDeltaUpdated: 1,
        changedFileCount: 0,
        sourceFilesFetched: 1,
        sourceFilesSkipped: 0,
        codeAnalysisEnabled: true,
        warningCodes: [],
      },
    });

    analyzeSpy.mockResolvedValue({
      totalScore: 50,
      layerScores: {
        security: 10,
        maintainability: 10,
        ecosystem: 10,
        upgradeImpact: 20,
      },
      findings: [],
      generatedAt: new Date().toISOString(),
      methodologyVersion: "engine-test-fixture/v1",
      decision: {
        recommendation: "needs_review",
        confidence: "medium",
        reasoning: [],
      },
      repoIntelligence: { packages: {} },
    });

    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("status IN ('queued', 'running')"))
          return { rowCount: 1 };
        if (sql.includes("heartbeat_at")) return { rowCount: 1 };
        if (sql.includes("status = 'done'")) return { rowCount: 1 };
        return { rows: [{ status: "running" }], rowCount: 1 };
      }),
    } as unknown as Pool;

    await executeScanJob(
      pool,
      { id: "contract-1", data: job } as Job<ScanQueueJob>,
      "w",
    );

    expect(analyzeSpy).toHaveBeenCalledTimes(1);
    const [req, codeAnalysis] = analyzeSpy.mock.calls[0]!;
    expect(req.changedPackages).toEqual(["react"]);
    expect(req.lockfilePackageDelta?.updated).toContain("react");
    expect(req.repoSource).toEqual(job.repoSource);
    expect(req.github).toEqual({
      owner: "acme",
      repo: "app",
      prNumber: 1,
    });
    expect(req.baseLockfile).toEqual(job.baseLockfile);
    expect(codeAnalysis).toBeDefined();
    expect(codeAnalysis!.fileContents.size).toBeGreaterThan(0);

    analyzeSpy.mockRestore();
  });

  it("prepareScanContext produces delta from real lockfiles", async () => {
    const prepared = await prepareScanContext({
      scanId: "prep-1",
      repoId: "acme/app",
      dependencyGraph: {},
      lockfile: { manager: "pnpm", content: pnpmHead },
      baseLockfile: { manager: "pnpm", content: pnpmBase },
    });
    expect(prepared.scanRequest.changedPackages).toContain("react");
    expect(prepared.scanRequest.lockfilePackageDelta?.updated).toContain(
      "react",
    );
    expect(prepared.scanRequest.baseLockfile).toEqual({
      manager: "pnpm",
      content: pnpmBase,
    });
  });

  it("records warnings and analysisPreparation when corpus missing", async () => {
    vi.spyOn(
      await import("@mergesignal/scan-prep"),
      "prepareScanContext",
    ).mockResolvedValue({
      scanRequest: {
        repoId: "acme/app",
        dependencyGraph: {},
        changedPackages: ["react"],
      },
      codeAnalysis: undefined,
      warnings: [
        {
          code: "code_fetch_failed",
          message: "timeout",
          details: { errorType: "timeout" },
        },
      ],
      preparationSummary: {
        changedPackageCount: 1,
        lockfileDeltaAdded: 0,
        lockfileDeltaRemoved: 0,
        lockfileDeltaUpdated: 1,
        changedFileCount: 0,
        sourceFilesFetched: 0,
        sourceFilesSkipped: 0,
        codeAnalysisEnabled: false,
        warningCodes: ["code_fetch_failed"],
      },
    });

    const analyzeSpy = vi
      .spyOn(await import("@mergesignal/engine"), "analyze")
      .mockResolvedValue({
        totalScore: 50,
        layerScores: {
          security: 10,
          maintainability: 10,
          ecosystem: 10,
          upgradeImpact: 20,
        },
        findings: [],
        generatedAt: new Date().toISOString(),
        methodologyVersion: "engine-test-fixture/v1",
        decision: {
          recommendation: "safe",
          confidence: "high",
          reasoning: [],
        },
      });

    let persisted: unknown;
    const pool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("status IN ('queued', 'running')"))
          return { rowCount: 1 };
        if (sql.includes("heartbeat_at")) return { rowCount: 1 };
        if (sql.includes("status = 'done'")) {
          persisted = JSON.parse(String(params?.[0]));
          return { rowCount: 1 };
        }
        return { rows: [{ status: "running" }], rowCount: 1 };
      }),
    } as unknown as Pool;

    await executeScanJob(
      pool,
      {
        id: "w",
        data: {
          scanId: "s",
          repoId: "acme/app",
          dependencyGraph: {},
        },
      } as Job<ScanQueueJob>,
      "w",
    );

    const result = persisted as {
      analysisPreparation?: { codeIntelligenceAvailable: boolean };
    };
    expect(result.analysisPreparation?.codeIntelligenceAvailable).toBe(false);
    expect(analyzeSpy.mock.calls[0]?.[1]).toBeUndefined();
    analyzeSpy.mockRestore();
  });
});
