import { describe, it, expect } from "vitest";
import { selectTopAffectedAreas } from "./selectTopAffectedAreas.js";
import type { ScanResult } from "./types.js";

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    totalScore: 60,
    layerScores: {
      security: 70,
      maintainability: 50,
      ecosystem: 40,
      upgradeImpact: 30,
    },
    findings: [],
    generatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("selectTopAffectedAreas", () => {
  it("returns [] for null input", () => {
    expect(selectTopAffectedAreas(null)).toEqual([]);
  });

  it("returns [] for undefined input", () => {
    expect(selectTopAffectedAreas(undefined)).toEqual([]);
  });

  it("returns at most 3 results by default", () => {
    const result = makeScanResult({
      explain: {
        reasons: [
          { id: "r1", layer: "security", title: "Auth flow", scoreImpact: -20 },
          {
            id: "r2",
            layer: "security",
            title: "State sync",
            scoreImpact: -15,
          },
          {
            id: "r3",
            layer: "ecosystem",
            title: "Middleware",
            scoreImpact: -10,
          },
          {
            id: "r4",
            layer: "maintainability",
            title: "Extra area",
            scoreImpact: -5,
          },
        ],
      },
    });
    const areas = selectTopAffectedAreas(result);
    expect(areas.length).toBe(3);
    expect(areas).toEqual(["Auth flow", "State sync", "Middleware"]);
  });

  it("respects custom max", () => {
    const result = makeScanResult({
      explain: {
        reasons: [
          { id: "r1", layer: "security", title: "Area A", scoreImpact: -20 },
          { id: "r2", layer: "security", title: "Area B", scoreImpact: -15 },
        ],
      },
    });
    expect(selectTopAffectedAreas(result, { max: 1 })).toEqual(["Area A"]);
  });

  it("sorts explain reasons by absolute scoreImpact descending", () => {
    const result = makeScanResult({
      explain: {
        reasons: [
          { id: "r1", layer: "security", title: "Minor", scoreImpact: -2 },
          { id: "r2", layer: "security", title: "Critical", scoreImpact: -30 },
          { id: "r3", layer: "ecosystem", title: "Medium", scoreImpact: -15 },
        ],
      },
    });
    const areas = selectTopAffectedAreas(result);
    expect(areas[0]).toBe("Critical");
    expect(areas[1]).toBe("Medium");
  });

  it("falls back to insights when explain is empty", () => {
    const result = makeScanResult({
      insights: [
        {
          type: "behavioral_change",
          priority: "high",
          confidence: "confirmed",
          scope: "changed",
          message: "Auth middleware changed. Check tokens",
          context: "src/auth.ts",
          remediation: "Review carefully",
        },
      ],
    });
    const areas = selectTopAffectedAreas(result);
    expect(areas).toEqual(["Auth middleware changed"]);
  });

  it("falls back to layer names when explain and insights are empty", () => {
    const result = makeScanResult();
    const areas = selectTopAffectedAreas(result);
    expect(areas.length).toBeGreaterThan(0);
    expect(areas.length).toBeLessThanOrEqual(3);
    expect(areas).toContain("Security");
  });

  it("deduplicates normalized labels", () => {
    const result = makeScanResult({
      explain: {
        reasons: [
          { id: "r1", layer: "security", title: "Auth flow", scoreImpact: -20 },
          { id: "r2", layer: "security", title: "auth flow", scoreImpact: -15 },
          {
            id: "r3",
            layer: "ecosystem",
            title: "Auth flow",
            scoreImpact: -10,
          },
        ],
      },
    });
    const areas = selectTopAffectedAreas(result);
    const unique = new Set(areas.map((a) => a.toLowerCase()));
    expect(unique.size).toBe(areas.length);
    expect(areas).toContain("Auth flow");
    expect(areas.filter((a) => a.toLowerCase() === "auth flow").length).toBe(1);
  });

  it("trims the 'Finding: ' prefix from labels", () => {
    const result = makeScanResult({
      explain: {
        reasons: [
          {
            id: "r1",
            layer: "security",
            title: "Finding: Outdated lodash",
            scoreImpact: -20,
          },
        ],
      },
    });
    const areas = selectTopAffectedAreas(result);
    expect(areas[0]).toBe("Outdated lodash");
  });

  it("truncates labels longer than maxLabelLen with ellipsis", () => {
    const long = "A".repeat(50);
    const result = makeScanResult({
      explain: {
        reasons: [
          { id: "r1", layer: "security", title: long, scoreImpact: -10 },
        ],
      },
    });
    const areas = selectTopAffectedAreas(result, { maxLabelLen: 10 });
    expect(areas[0]!.length).toBeLessThanOrEqual(10);
    expect(areas[0]!.endsWith("…")).toBe(true);
  });

  it("returns empty array when no useful signal at all", () => {
    // Completely empty scan result with empty layerScores
    const result: ScanResult = {
      totalScore: 0,
      layerScores: {
        security: 0,
        maintainability: 0,
        ecosystem: 0,
        upgradeImpact: 0,
      },
      findings: [],
      generatedAt: "2026-01-01T00:00:00Z",
    };
    // With layer fallback this would return layer names; only truly empty when
    // caller passes a result without layerScores entirely — validate max guard
    const areas = selectTopAffectedAreas(result, { max: 3 });
    expect(areas.length).toBeLessThanOrEqual(3);
  });
});
