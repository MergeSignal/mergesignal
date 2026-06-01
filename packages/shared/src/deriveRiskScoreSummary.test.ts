import { describe, expect, it } from "vitest";
import {
  deriveOverallRiskBand,
  deriveSignalSummary,
  SCAN_DETAIL_RISK_BAND_HIGH_MIN,
  SCAN_DETAIL_RISK_BAND_MODERATE_MIN,
} from "./deriveRiskScoreSummary.js";
import type { ScanResult } from "./types.js";

const baseResult = {
  totalScore: 71,
  layerScores: {
    security: 80,
    maintainability: 65,
    ecosystem: 55,
    upgradeImpact: 70,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
} satisfies ScanResult;

describe("deriveOverallRiskBand", () => {
  it("uses 40/80 thresholds", () => {
    expect(SCAN_DETAIL_RISK_BAND_MODERATE_MIN).toBe(40);
    expect(SCAN_DETAIL_RISK_BAND_HIGH_MIN).toBe(80);
    expect(deriveOverallRiskBand(39)).toBe("low");
    expect(deriveOverallRiskBand(40)).toBe("moderate");
    expect(deriveOverallRiskBand(71)).toBe("moderate");
    expect(deriveOverallRiskBand(79)).toBe("moderate");
    expect(deriveOverallRiskBand(80)).toBe("high");
  });
});

describe("deriveSignalSummary", () => {
  it("returns moderate band for score 71 on safe posture", () => {
    const summary = deriveSignalSummary({
      ...baseResult,
      decision: { recommendation: "safe", confidence: "high", reasoning: [] },
    });
    expect(summary?.score).toBe(71);
    expect(summary?.overallBand).toBe("moderate");
    expect(summary?.overallLabel).toBe("Moderate");
    expect(summary?.gauge.fillPercent).toBe(71);
  });

  it("returns null when totalScore is missing", () => {
    expect(
      deriveSignalSummary({
        ...baseResult,
        totalScore: Number.NaN,
      }),
    ).toBeNull();
  });

  it("uses short signal labels on layer rows", () => {
    const summary = deriveSignalSummary(baseResult);
    expect(summary?.layers).toHaveLength(4);
    expect(summary?.layers[0]?.concernLabel).toBe("Elevated");
  });
});
