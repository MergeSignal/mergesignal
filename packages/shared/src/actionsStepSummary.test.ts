import { describe, it, expect } from "vitest";
import {
  ACTIONS_SUMMARY_DEFAULT_MAX_CHARS,
  ACTIONS_SUMMARY_DEFAULT_MAX_LINES,
  actionsSummaryDefaultFoldPrefix,
  buildActionsStepSummaryMarkdown,
  humanizeEngineSurfaceText,
  layerDriverSummary,
  layerRiskBandLabel,
  sortPRInsightsForDisplay,
  sortRecommendationsForDisplay,
} from "./actionsStepSummary.js";
import { scanSurfaceCopyFlat } from "./scanSurfaceCopy.js";
import type { PRInsight, Recommendation, ScanResult } from "./types.js";

const copy = scanSurfaceCopyFlat();

function makeInsight(
  overrides: Partial<PRInsight> & Pick<PRInsight, "message">,
): PRInsight {
  return {
    type: "usage_risk",
    priority: "high",
    confidence: "likely",
    scope: "changed",
    context: "ctx",
    remediation: "fix",
    ...overrides,
  };
}

describe("layerRiskBandLabel", () => {
  it("maps numeric layer scores to Low / Moderate / High", () => {
    expect(layerRiskBandLabel(0)).toBe("Low");
    expect(layerRiskBandLabel(19.9)).toBe("Low");
    expect(layerRiskBandLabel(25)).toBe("Moderate");
    expect(layerRiskBandLabel(50)).toBe("High");
    expect(layerRiskBandLabel(null)).toBe("—");
  });
});

describe("humanizeEngineSurfaceText", () => {
  it("rewrites known graph metric tokens without adding new facts", () => {
    expect(humanizeEngineSurfaceText("graph.depth")).toBe(
      "Indirect dependency depth",
    );
    expect(humanizeEngineSurfaceText("graph.transitive volume")).toBe(
      "Transitive dependency volume",
    );
    expect(humanizeEngineSurfaceText("graph.fan in max")).toBe(
      "Many import paths converge on a few widely shared packages",
    );
  });

  it("rewrites ecosystem surface and duplicate-path tokens", () => {
    expect(humanizeEngineSurfaceText("Ecosystem.package surface")).toBe(
      "Broad declared package footprint",
    );
    expect(humanizeEngineSurfaceText("Graph.duplicates")).toBe(
      "Overlapping dependency paths to the same packages",
    );
  });

  it("merges dependency depth phrasing into one canonical reviewer line", () => {
    expect(humanizeEngineSurfaceText("dependency chain depth")).toBe(
      "Indirect dependency depth",
    );
    expect(humanizeEngineSurfaceText("dependency depth")).toBe(
      "Indirect dependency depth",
    );
  });

  it("leaves ordinary explain titles mostly intact", () => {
    expect(
      humanizeEngineSurfaceText("Duplicate majors on runtime boundary"),
    ).toBe("Duplicate majors on runtime boundary");
  });
});

describe("sortPRInsightsForDisplay", () => {
  it("orders by priority, confidence, then changed scope", () => {
    const a = makeInsight({
      message: "a",
      priority: "medium",
      confidence: "confirmed",
      scope: "all",
    });
    const b = makeInsight({
      message: "b",
      priority: "high",
      confidence: "likely",
      scope: "changed",
    });
    const c = makeInsight({
      message: "c",
      priority: "high",
      confidence: "confirmed",
      scope: "all",
    });
    expect(sortPRInsightsForDisplay([a, b, c]).map((i) => i.message)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });
});

describe("sortRecommendationsForDisplay", () => {
  it("orders by priorityScore then impact", () => {
    const recs: Recommendation[] = [
      {
        id: "1",
        title: "Low prio",
        rationale: "",
        impact: "low",
        priorityScore: 10,
      },
      {
        id: "2",
        title: "High prio",
        rationale: "",
        impact: "high",
        priorityScore: 90,
      },
    ];
    expect(sortRecommendationsForDisplay(recs).map((r) => r.id)).toEqual([
      "2",
      "1",
    ]);
  });
});

describe("buildActionsStepSummaryMarkdown", () => {
  const trustedBase: ScanResult = {
    totalScore: 42,
    layerScores: {
      security: 10,
      maintainability: 50,
      ecosystem: 30,
      upgradeImpact: 40,
    },
    findings: [],
    recommendations: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    methodologyVersion: "engine-test-fixture/v1",
    decision: {
      recommendation: "needs_review",
      confidence: "high",
      reasoning: ["Transitive dependency depth increased on hot paths."],
    },
    insights: [],
  };

  it("trusted: includes posture, risk index direction, and score breakdown", () => {
    const md = buildActionsStepSummaryMarkdown({
      result: trustedBase,
      profile: "trusted",
      copy,
    });
    expect(md).toMatch(/# MergeSignal dependency review — Needs review/);
    expect(md).toMatch(/Risk index 42\/100/);
    expect(md).toContain(copy["actions.riskIndexDirectionShort"]!);
    expect(md).toContain("| Layer | Score | Layer risk |");
    expect(md).toContain("| Security | 10 | Low |");
    expect(md).toMatch(/<details>/);
    expect(md).not.toContain(copy["actions.layerScoreGlossary"]!);
  });

  it("trusted: surfaces top insights and moves remainder to details", () => {
    const insights: PRInsight[] = [
      makeInsight({ message: "First critical", priority: "critical" }),
      makeInsight({ message: "Second high", priority: "high" }),
      makeInsight({ message: "Third medium", priority: "medium" }),
      makeInsight({ message: "Fourth overflow", priority: "medium" }),
    ];
    const md = buildActionsStepSummaryMarkdown({
      result: { ...trustedBase, insights },
      profile: "trusted",
      copy,
    });
    expect(md).toContain("First critical");
    expect(md).toContain(copy["actions.moreInsightsDetailsSummary"]!);
    expect(md).toContain("Fourth overflow");
  });

  it("trusted: no decision uses posture-unavailable copy", () => {
    const { decision: _d, ...rest } = trustedBase;
    const md = buildActionsStepSummaryMarkdown({
      result: rest as ScanResult,
      profile: "trusted",
      copy,
    });
    expect(md).toContain(copy["actions.mergePostureUnavailableShort"]!);
  });

  it("development + stub shows demo banner and score breakdown", () => {
    const md = buildActionsStepSummaryMarkdown({
      result: {
        ...trustedBase,
        methodologyVersion: "engine-stub/v2",
        decision: {
          recommendation: "safe",
          confidence: "high",
          reasoning: [],
        },
      },
      profile: "development",
      copy,
    });
    expect(md).toContain(copy["actions.demoSummaryBanner"]!);
    expect(md).toContain("| Layer | Score | Layer risk |");
    expect(md).toContain(copy["actions.layerScoreGlossary"]!);
  });

  it("default-fold budget: heavy fixture stays within caps", () => {
    const long = "x".repeat(400);
    const insights: PRInsight[] = Array.from({ length: 12 }, (_, i) =>
      makeInsight({
        message: `${long} ${i}`,
        priority: i === 0 ? "critical" : "medium",
      }),
    );
    const recs: Recommendation[] = Array.from({ length: 8 }, (_, i) => ({
      id: `r${i}`,
      title: `Rec ${i}`,
      rationale: long,
      impact: "high" as const,
      priorityScore: 100 - i,
    }));
    const md = buildActionsStepSummaryMarkdown({
      result: {
        ...trustedBase,
        insights,
        recommendations: recs,
        explain: {
          reasons: Array.from({ length: 10 }, (_, i) => ({
            id: `e${i}`,
            layer: "security" as const,
            title: `Explain ${i}`,
            scoreImpact: 1,
          })),
        },
      },
      profile: "trusted",
      copy,
    });
    const prefix = actionsSummaryDefaultFoldPrefix(md);
    expect(prefix.split("\n").length).toBeLessThanOrEqual(
      ACTIONS_SUMMARY_DEFAULT_MAX_LINES + 4,
    );
    expect(prefix.length).toBeLessThanOrEqual(
      ACTIONS_SUMMARY_DEFAULT_MAX_CHARS + 400,
    );
  });

  it("includes scan-specific layer drivers from explain.reasons", () => {
    const md = buildActionsStepSummaryMarkdown({
      result: {
        ...trustedBase,
        layerScores: { ...trustedBase.layerScores!, maintainability: 72 },
        explain: {
          reasons: [
            {
              id: "x",
              layer: "maintainability",
              title: "Duplicate majors on runtime boundary",
              scoreImpact: 12,
            },
            {
              id: "y",
              layer: "maintainability",
              title: "Churn in devDependencies cluster",
              scoreImpact: 5,
            },
          ],
        },
      },
      profile: "trusted",
      copy,
    });
    expect(md).toContain(copy["actions.layerDriversHeading"]!);
    expect(md).toContain("Duplicate majors on runtime boundary");
  });

  it("layerDriverSummary returns null when no explain data for layer", () => {
    expect(layerDriverSummary(trustedBase, "security", 120)).toBeNull();
  });

  it("generic recommendation titles lead with rationale in default fold", () => {
    const md = buildActionsStepSummaryMarkdown({
      result: {
        ...trustedBase,
        insights: [],
        recommendations: [
          {
            id: "r1",
            title: "Reduce transitive dependency surface area",
            rationale:
              "This PR adds lodash twice at incompatible semver ranges pulled through different path aliases, widening the install tree.",
            impact: "high",
            priorityScore: 90,
          },
        ],
      },
      profile: "trusted",
      copy,
    });
    expect(md).toContain(copy["actions.recReviewLeadPrefix"]!);
    expect(md).toContain("incompatible semver");
    expect(md).toContain("*Focus:*");
    expect(md).toContain("Reduce transitive dependency surface area");
  });

  it("applies rec review prefix only to the first rationale-first recommendation", () => {
    const md = buildActionsStepSummaryMarkdown({
      result: {
        ...trustedBase,
        insights: [],
        recommendations: [
          {
            id: "r1",
            title: "Reduce transitive dependency surface area",
            rationale:
              "This PR adds lodash twice at incompatible semver ranges pulled through different path aliases, widening the install tree.",
            impact: "high",
            priorityScore: 90,
          },
          {
            id: "r2",
            title: "Minimize dependency footprint in the service layer",
            rationale:
              "Several packages are pulled in only for types while runtime bundles still resolve overlapping majors, which increases upgrade coupling across services.",
            impact: "high",
            priorityScore: 85,
          },
        ],
      },
      profile: "trusted",
      copy,
    });
    const prefix = copy["actions.recReviewLeadPrefix"]!;
    const first = md.indexOf(prefix);
    const second = md.indexOf(prefix, first + 1);
    expect(first).toBeGreaterThan(-1);
    expect(second).toBe(-1);
  });

  it("humanizes graph metric tokens in explain-driven layer drivers", () => {
    const md = buildActionsStepSummaryMarkdown({
      result: {
        ...trustedBase,
        layerScores: { ...trustedBase.layerScores!, maintainability: 72 },
        explain: {
          reasons: [
            {
              id: "gdepth",
              layer: "maintainability",
              title: "graph.depth",
              scoreImpact: 12,
            },
          ],
        },
      },
      profile: "trusted",
      copy,
    });
    expect(md).toContain("Indirect dependency depth");
    expect(md).not.toContain("graph.depth");
  });

  it("includes graph details when graphInsights present", () => {
    const md = buildActionsStepSummaryMarkdown({
      result: {
        ...trustedBase,
        graphInsights: {
          maxDepth: 7,
          nodes: 900,
          edges: 1200,
          deepest: [
            {
              kind: "deep" as const,
              packageName: "lodash",
              direct: false,
              depth: 7,
              via: ["a", "b"],
            },
          ],
          hotspots: [
            {
              kind: "hotspot" as const,
              packageName: "x",
              direct: true,
              depth: 1,
            },
          ],
          vulnerable: [],
        },
      },
      profile: "trusted",
      copy,
    });
    expect(md).toContain(copy["actions.dependencyGraphDetailsSummary"]!);
    expect(md).toContain("moderately deep");
    expect(md).toContain("fairly broad");
    expect(md).toMatch(/> \*max chain length 7 · 900 resolved packages\*/);
  });
});
