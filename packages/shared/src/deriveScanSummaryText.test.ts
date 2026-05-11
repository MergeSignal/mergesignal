import { describe, it, expect } from "vitest";
import { deriveScanSummaryText } from "./deriveScanSummaryText.js";
import type { ScanResult } from "./types.js";

describe("deriveScanSummaryText", () => {
  it("returns null for empty input", () => {
    expect(deriveScanSummaryText(undefined)).toBeNull();
    expect(deriveScanSummaryText(null)).toBeNull();
  });

  it("uses first decision reasoning", () => {
    const r = {
      totalScore: 10,
      layerScores: {
        security: 1,
        maintainability: 2,
        ecosystem: 3,
        upgradeImpact: 4,
      },
      findings: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
      decision: {
        recommendation: "needs_review" as const,
        confidence: "medium" as const,
        reasoning: ["First reason line", "Second"],
      },
    } satisfies ScanResult;
    expect(deriveScanSummaryText(r)).toBe("First reason line");
  });

  it("truncates long reasoning", () => {
    const long = "a".repeat(130);
    const r = {
      totalScore: 10,
      layerScores: {
        security: 1,
        maintainability: 2,
        ecosystem: 3,
        upgradeImpact: 4,
      },
      findings: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
      decision: {
        recommendation: "safe" as const,
        confidence: "high" as const,
        reasoning: [long],
      },
    } satisfies ScanResult;
    expect(deriveScanSummaryText(r)!.length).toBe(120);
    expect(deriveScanSummaryText(r)!.endsWith("…")).toBe(true);
  });

  it("falls back to high-severity findings", () => {
    const r = {
      totalScore: 80,
      layerScores: {
        security: 80,
        maintainability: 10,
        ecosystem: 10,
        upgradeImpact: 10,
      },
      findings: [
        {
          id: "1",
          title: "x",
          description: "d",
          severity: "high" as const,
          packageName: "p",
        },
        {
          id: "2",
          title: "y",
          description: "d",
          severity: "high" as const,
          packageName: "q",
        },
      ],
      generatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies ScanResult;
    expect(deriveScanSummaryText(r)).toBe("2 high-severity findings detected");
  });
});
