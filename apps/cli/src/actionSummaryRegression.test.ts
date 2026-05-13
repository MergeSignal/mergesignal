import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const renderSummary = join(
  repoRoot,
  "scripts/ci/render-mergesignal-step-summary.mjs",
);
const renderFailure = join(
  repoRoot,
  "scripts/ci/render-mergesignal-failure-summary.mjs",
);
const copyJson = join(repoRoot, "scripts/ci/scan-surface-copy.generated.json");

const stubLikeResult = {
  totalScore: 10,
  layerScores: {
    security: 10,
    maintainability: 10,
    ecosystem: 10,
    upgradeImpact: 10,
  },
  findings: [],
  recommendations: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
  methodologyVersion: "engine-stub/v2",
};

const trustedLikeResult = {
  ...stubLikeResult,
  methodologyVersion: "engine-test-fixture/v1",
  decision: {
    recommendation: "safe" as const,
    confidence: "high" as const,
    reasoning: [] as string[],
  },
};

function runRender(
  profile: string,
  jsonPath: string,
): { status: number; summary: string } {
  const dir = mkdtempSync(join(tmpdir(), "ms-sum-"));
  const summaryPath = join(dir, "step-summary.md");
  writeFileSync(summaryPath, "");
  const r = spawnSync(process.execPath, [renderSummary, jsonPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_STEP_SUMMARY: summaryPath,
      MERGESIGNAL_ACTIONS_SUMMARY_PROFILE: profile,
    },
  });
  return {
    status: r.status ?? 1,
    summary: readFileSync(summaryPath, "utf8"),
  };
}

describe("GitHub Actions step summary scripts", () => {
  let jsonFile: string;

  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), "ms-json-"));
    jsonFile = join(dir, "scan.json");
  });

  it("refuses trusted profile for stub methodology (no scorecard path)", () => {
    writeFileSync(jsonFile, JSON.stringify(stubLikeResult));
    const { status, summary } = runRender("trusted", jsonFile);
    expect(status).toBe(1);
    expect(summary).not.toMatch(/MergeSignal Scan: Score/);
  });

  it("development profile renders demo disclaimer for stub output", () => {
    writeFileSync(jsonFile, JSON.stringify(stubLikeResult));
    const { status, summary } = runRender("development", jsonFile);
    expect(status).toBe(0);
    const demo = JSON.parse(readFileSync(copyJson, "utf8")) as Record<
      string,
      string
    >;
    expect(summary).toContain(demo["actions.demoSummaryBanner"]);
    expect(summary).toContain("MergeSignal (demo output)");
  });

  it("trusted profile renders production score header for non-stub result", () => {
    writeFileSync(jsonFile, JSON.stringify(trustedLikeResult));
    const { status, summary } = runRender("trusted", jsonFile);
    expect(status).toBe(0);
    expect(summary).toMatch(/# MergeSignal Scan: Score/);
  });

  it("failure summary never mimics success scorecard", () => {
    const dir = mkdtempSync(join(tmpdir(), "ms-fail-"));
    const summaryPath = join(dir, "step-summary.md");
    writeFileSync(summaryPath, "");
    spawnSync(process.execPath, [renderFailure], {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_STEP_SUMMARY: summaryPath,
      },
    });
    const summary = readFileSync(summaryPath, "utf8");
    expect(summary).not.toMatch(/MergeSignal Scan: Score/);
    expect(summary).not.toMatch(/Recommended actions/);
    expect(summary).toMatch(/Analysis could not be completed/);
  });
});

describe("Trusted CLI with engine-test-fixture", () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.MERGESIGNAL_TRUSTED_ANALYSIS = "1";
    process.env.MERGESIGNAL_ENGINE_IMPL = "@mergesignal/engine-test-fixture";
    delete process.env.MERGESIGNAL_ALLOW_STUB;
    const { __resetEngineLoaderCacheForTests } =
      await import("@mergesignal/engine");
    __resetEngineLoaderCacheForTests();
  });

  afterEach(async () => {
    process.env = originalEnv;
    const { __resetEngineLoaderCacheForTests } =
      await import("@mergesignal/engine");
    __resetEngineLoaderCacheForTests();
  });

  it("produces valid JSON scan via workspace engine", async () => {
    const { analyze } = await import("@mergesignal/engine");
    const r = await analyze({ repoId: "o/r", dependencyGraph: {} });
    expect(r.methodologyVersion).toMatch(/^engine-test-fixture\//);
  });
});
