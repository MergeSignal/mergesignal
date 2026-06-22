import { describe, expect, it } from "vitest";
import { deriveRiskSignals } from "./riskSignals.js";
import { resolveRepositoryHealthScore } from "./prRiskWire.js";
import type { ScanResult } from "./types.js";

function baseResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    totalScore: 63,
    layerScores: {
      security: 10,
      maintainability: 20,
      ecosystem: 30,
      upgradeImpact: 15,
    },
    findings: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("deriveRiskSignals", () => {
  it("prefers prRisk.score over totalScore and repositoryHealth", () => {
    const result = baseResult({
      prRisk: { score: 55 },
      repositoryHealth: { totalScore: 63 },
      totalScore: 63,
    });

    expect(deriveRiskSignals(result)?.riskIndex).toBe(55);
    expect(resolveRepositoryHealthScore(result)).toBe(63);
  });

  it("falls back to totalScore when prRisk is missing (historical scans)", () => {
    const result = baseResult({ totalScore: 48 });

    expect(deriveRiskSignals(result)?.riskIndex).toBe(48);
  });
});
