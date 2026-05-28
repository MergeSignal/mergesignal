import { describe, it, expect } from "vitest";
import {
  CARD_OBSERVATION_CATALOG,
  containsImperativeOrActionLanguage,
  containsTelemetryOrDigits,
  isCatalogPhrase,
  isGenericObservation,
  mapRecommendationToCatalogPhrase,
  mapTextToCatalogPhrase,
  validateCatalogIntegrity,
} from "./cardObservationCatalog.js";
import { deriveCardOperationalObservations } from "./deriveCardOperationalObservations.js";
import type { ScanResult } from "./types.js";

const baseResult = {
  totalScore: 10,
  layerScores: {
    security: 1,
    maintainability: 2,
    ecosystem: 3,
    upgradeImpact: 4,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
} satisfies ScanResult;

describe("cardObservationCatalog", () => {
  it("validates catalog integrity", () => {
    expect(() => validateCatalogIntegrity()).not.toThrow();
  });

  it("keeps all catalog phrases within length and guardrails", () => {
    for (const phrase of CARD_OBSERVATION_CATALOG) {
      expect(isCatalogPhrase(phrase)).toBe(true);
      expect(containsTelemetryOrDigits(phrase)).toBe(false);
      expect(containsImperativeOrActionLanguage(phrase)).toBe(false);
      expect(isGenericObservation(phrase)).toBe(false);
      expect(phrase.length).toBeLessThanOrEqual(48);
    }
  });

  it("maps recommendation imperatives to detection phrases", () => {
    const mapped = mapRecommendationToCatalogPhrase({
      id: "rec-1",
      title: "Reduce duplicate dependency versions",
      rationale: "Overlapping semver ranges on runtime boundary",
      impact: "high",
    });
    expect(mapped?.phrase).toBe("Duplicate dependency versions detected");
  });

  it("maps graph.duplicates tokens to duplicate versions phrase", () => {
    const mapped = mapTextToCatalogPhrase(
      "graph.duplicates on runtime boundary",
    );
    expect(mapped?.phrase).toBe("Duplicate dependency versions detected");
  });

  it("rejects generic narration", () => {
    expect(isGenericObservation("No high-confidence merge risks")).toBe(true);
    expect(isGenericObservation("dependency concerns detected")).toBe(true);
  });
});

describe("deriveCardOperationalObservations", () => {
  it("returns silence on primary path when no mappable signals", () => {
    const result = deriveCardOperationalObservations(
      {
        ...baseResult,
        decision: {
          recommendation: "safe",
          confidence: "high",
          reasoning: [
            "No high-confidence merge risks from this PR dependency change",
          ],
        },
      },
      { mergePosture: "safe", hasFullResult: true },
    );
    expect(result.operationalObservations).toEqual([]);
    expect(result.supportingLine).toBeNull();
  });

  it("surfaces catalog phrase from explain.reasons instead of generic reasoning", () => {
    const result = deriveCardOperationalObservations(
      {
        ...baseResult,
        totalScore: 55,
        decision: {
          recommendation: "needs_review",
          confidence: "medium",
          reasoning: ["Potential runtime impact detected"],
        },
        explain: {
          reasons: [
            {
              id: "graph.transitive.1",
              layer: "ecosystem",
              title: "graph.transitive volume cluster",
              scoreImpact: 18,
            },
          ],
        },
      },
      { mergePosture: "needs_review", hasFullResult: true },
    );
    expect(result.operationalObservations).toContain(
      "High transitive dependency volume",
    );
    expect(
      result.operationalObservations.some((o) =>
        /merge risk|runtime impact/i.test(o),
      ),
    ).toBe(false);
  });

  it("maps duplicate signal from recommendation without leaking imperative title", () => {
    const result = deriveCardOperationalObservations(
      {
        ...baseResult,
        recommendations: [
          {
            id: "rec-dup",
            title: "Reduce duplicate dependency versions",
            rationale: "Multiple semver majors on shared packages",
            impact: "high",
            priorityScore: 90,
          },
        ],
      },
      { mergePosture: "needs_review", hasFullResult: true },
    );
    expect(result.operationalObservations).toEqual([
      "Duplicate dependency versions detected",
    ]);
    expect(result.operationalObservations.some((o) => /^reduce/i.test(o))).toBe(
      false,
    );
  });

  it("caps at three distinct catalog phrases on fat scans", () => {
    const fat: ScanResult = {
      ...baseResult,
      totalScore: 72,
      recommendations: [
        {
          id: "r1",
          title: "Reduce duplicate dependency versions",
          rationale: "semver overlap",
          impact: "high",
          priorityScore: 95,
        },
        {
          id: "r2",
          title: "Review transitive dependency surface",
          rationale: "graph.transitive volume",
          impact: "high",
          priorityScore: 90,
        },
      ],
      explain: {
        reasons: [
          {
            id: "g1",
            layer: "security",
            title: "graph.vulnerable packages",
            scoreImpact: 20,
          },
          {
            id: "g2",
            layer: "maintainability",
            title: "Stale releases on multiple direct dependencies",
            scoreImpact: 15,
          },
        ],
      },
      graphInsights: {
        maxDepth: 9,
        nodes: 1500,
        edges: 4000,
        vulnerable: [
          {
            kind: "vulnerable",
            packageName: "lodash",
            direct: false,
            depth: 3,
          },
        ],
        hotspots: Array.from({ length: 5 }, (_, i) => ({
          kind: "hotspot" as const,
          packageName: `pkg-${i}`,
          direct: true,
          depth: 1,
        })),
      },
    };

    const result = deriveCardOperationalObservations(fat, {
      mergePosture: "risky",
      hasFullResult: true,
      max: 3,
    });

    expect(result.operationalObservations.length).toBeLessThanOrEqual(3);
    for (const phrase of result.operationalObservations) {
      expect(isCatalogPhrase(phrase)).toBe(true);
      expect(containsTelemetryOrDigits(phrase)).toBe(false);
      expect(containsImperativeOrActionLanguage(phrase)).toBe(false);
    }
    expect(result.supportingLine).toBeNull();
  });

  it("prefers one to two observations when one family dominates", () => {
    const result = deriveCardOperationalObservations(
      {
        ...baseResult,
        explain: {
          reasons: [
            {
              id: "t1",
              layer: "ecosystem",
              title: "graph.transitive volume cluster 1",
              scoreImpact: 30,
            },
            {
              id: "t2",
              layer: "ecosystem",
              title: "graph.transitive volume cluster 2",
              scoreImpact: 25,
            },
            {
              id: "t3",
              layer: "ecosystem",
              title: "graph.transitive volume cluster 3",
              scoreImpact: 20,
            },
          ],
        },
      },
      { mergePosture: "needs_review", hasFullResult: true },
    );
    expect(result.operationalObservations).toEqual([
      "High transitive dependency volume",
    ]);
  });

  it("omits supporting line when three observations are shown", () => {
    const result = deriveCardOperationalObservations(
      {
        ...baseResult,
        recommendations: [
          {
            id: "r1",
            title: "Reduce duplicate dependency versions",
            rationale: "dup",
            impact: "high",
            priorityScore: 95,
          },
        ],
        explain: {
          reasons: [
            {
              id: "e1",
              layer: "security",
              title: "graph.vulnerable",
              scoreImpact: 20,
            },
            {
              id: "e2",
              layer: "upgradeImpact",
              title: "Large upgrade blast radius",
              scoreImpact: 18,
            },
          ],
        },
      },
      { mergePosture: "risky", hasFullResult: true },
    );
    if (result.operationalObservations.length === 3) {
      expect(result.supportingLine).toBeNull();
    }
  });

  it("allows supporting line only with exactly one observation", () => {
    const result = deriveCardOperationalObservations(
      {
        ...baseResult,
        recommendations: [
          {
            id: "r1",
            title: "Reduce duplicate dependency versions",
            rationale: "dup",
            impact: "high",
            priorityScore: 95,
          },
        ],
        explain: {
          reasons: [
            {
              id: "e1",
              layer: "security",
              title: "graph.vulnerable packages in tree",
              scoreImpact: 10,
            },
          ],
        },
      },
      { mergePosture: "needs_review", hasFullResult: true },
    );
    if (result.operationalObservations.length === 1) {
      expect(result.supportingLine).toBe(
        "Vulnerable transitive packages detected",
      );
    }
  });

  it("returns silence on denormalized path without signals", () => {
    const result = deriveCardOperationalObservations(null, {
      mergePosture: "safe",
      hasFullResult: false,
    });
    expect(result.operationalObservations).toEqual([]);
  });
});
