import { describe, expect, it } from "vitest";
import type { ScanResult } from "./types.js";
import {
  resolvePrRiskLayerScores,
  resolvePrRiskScore,
  resolvePrRiskScoreFromRow,
  resolveRepositoryHealthScore,
  resolveRepositoryHealthScoreFromRow,
} from "./prRiskWire.js";

function baseResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    totalScore: 50,
    layerScores: {
      security: 10,
      maintainability: 20,
      ecosystem: 30,
      upgradeImpact: 40,
    },
    findings: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolvePrRiskScore", () => {
  it("prefers prRisk.score", () => {
    const result = baseResult({
      prRisk: { score: 72 },
      totalScore: 50,
    });
    expect(resolvePrRiskScore(result)).toBe(72);
  });

  it("falls back to denormalized column", () => {
    expect(resolvePrRiskScore(null, { prRiskScore: 61 })).toBe(61);
  });

  it("falls back to legacy total_score column before JSON totalScore", () => {
    expect(resolvePrRiskScore(null, { legacyTotalScore: 48 })).toBe(48);
  });

  it("falls back to JSON totalScore for historical scans", () => {
    expect(resolvePrRiskScore(baseResult({ totalScore: 48 }))).toBe(48);
  });

  it("returns null when no score available", () => {
    expect(resolvePrRiskScore(baseResult({ totalScore: NaN }))).toBeNull();
  });
});

describe("resolvePrRiskScoreFromRow", () => {
  it("uses pr_risk_score for new rows without legacy column", () => {
    expect(
      resolvePrRiskScoreFromRow({
        pr_risk_score: 55,
        total_score: null,
      }),
    ).toBe(55);
  });

  it("uses legacy total_score only when pr_risk_score is absent", () => {
    expect(
      resolvePrRiskScoreFromRow({
        pr_risk_score: null,
        total_score: 40,
      }),
    ).toBe(40);
  });
});

describe("resolvePrRiskLayerScores", () => {
  it("prefers prRisk.layerScores", () => {
    const layers = {
      security: 1,
      maintainability: 2,
      ecosystem: 3,
      upgradeImpact: 4,
    };
    const result = baseResult({ prRisk: { score: 10, layerScores: layers } });
    expect(resolvePrRiskLayerScores(result)).toEqual(layers);
  });
});

describe("resolveRepositoryHealthScore", () => {
  it("prefers repositoryHealth.totalScore", () => {
    const result = baseResult({
      repositoryHealth: { totalScore: 80 },
      totalScore: 50,
    });
    expect(resolveRepositoryHealthScore(result)).toBe(80);
  });

  it("falls back to denormalized column", () => {
    expect(
      resolveRepositoryHealthScore(null, { repositoryHealthScore: 66 }),
    ).toBe(66);
  });

  it("falls back to legacy total_score column for non-PR scans", () => {
    expect(resolveRepositoryHealthScore(null, { legacyTotalScore: 55 })).toBe(
      55,
    );
  });

  it("uses JSON totalScore only for non-PR scans", () => {
    expect(resolveRepositoryHealthScore(baseResult({ totalScore: 55 }))).toBe(
      55,
    );
  });

  it("does not use legacy scores for PR scans", () => {
    expect(
      resolveRepositoryHealthScore(null, {
        legacyTotalScore: 55,
        isPrScan: true,
      }),
    ).toBeNull();
    expect(
      resolveRepositoryHealthScore(baseResult({ totalScore: 55 }), {
        isPrScan: true,
      }),
    ).toBeNull();
  });
});

describe("resolveRepositoryHealthScoreFromRow", () => {
  it("uses repository_health_score for new rows", () => {
    expect(
      resolveRepositoryHealthScoreFromRow({
        repository_health_score: 70,
        total_score: null,
        github_pr_number: null,
      }),
    ).toBe(70);
  });

  it("does not use total_score for PR scans", () => {
    expect(
      resolveRepositoryHealthScoreFromRow({
        repository_health_score: null,
        total_score: 40,
        github_pr_number: 12,
      }),
    ).toBeNull();
  });
});
