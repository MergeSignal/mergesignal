import { describe, expect, it } from "vitest";
import {
  CHECK_RUN_MAX_ACTION_BULLETS,
  CHECK_RUN_SOFT_MAX_CHARS,
  buildPrCheckRunSummaryMarkdown,
  buildPrCheckRunTitle,
  deriveCheckRunPolicy,
  formatScanDashboardUrl,
  hasStrongRepoGraphDrivers,
} from "./prCheckRunPresentation.js";
import type { ScanResult } from "./types.js";

const ORIGIN = "https://mergesignal-web.fly.dev";
const SCAN_ID = "11111111-1111-4111-8111-111111111111";

function minimalResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    totalScore: 42,
    layerScores: {
      security: 10,
      maintainability: 20,
      ecosystem: 30,
      upgradeImpact: 15,
    },
    findings: [],
    generatedAt: new Date().toISOString(),
    decision: {
      recommendation: "needs_review",
      confidence: "medium",
      reasoning: ["Lockfile adds transitive depth on shared utilities."],
    },
    explain: {
      reasons: [
        {
          id: "graph.depth",
          layer: "ecosystem",
          title: "graph.depth",
          scoreImpact: 12,
        },
      ],
    },
    ...overrides,
  };
}

describe("buildPrCheckRunTitle", () => {
  it("uses short product title without app prefix", () => {
    expect(buildPrCheckRunTitle()).toBe("PR dependency change");
    expect(buildPrCheckRunTitle()).not.toContain("MergeSignal scan");
    expect(buildPrCheckRunTitle()).not.toContain("—");
  });

  it("appends baseline suffix when requested", () => {
    expect(buildPrCheckRunTitle({ baselineOnly: true })).toBe(
      "PR dependency change - baseline scan only",
    );
  });
});

describe("formatScanDashboardUrl", () => {
  it("strips trailing slash from origin", () => {
    expect(formatScanDashboardUrl(`${ORIGIN}/`, SCAN_ID)).toBe(
      `${ORIGIN}/scan/${SCAN_ID}`,
    );
  });
});

describe("deriveCheckRunPolicy", () => {
  it("never shows repo graph context in baseline", () => {
    const rich = minimalResult({
      totalScore: 68,
      explain: {
        reasons: [
          {
            id: "graph.transitive",
            layer: "ecosystem",
            title: "Large transitive dependency volume",
            scoreImpact: 20,
          },
        ],
      },
    });
    const policy = deriveCheckRunPolicy(rich, { baseline: true });
    expect(policy.showRepoGraphContext).toBe(false);
    expect(policy.baseline).toBe(true);
  });

  it("shows repo graph context in full only with strong drivers", () => {
    const weak = minimalResult({
      explain: { reasons: [] },
      decision: {
        recommendation: "safe",
        confidence: "high",
        reasoning: [],
      },
    });
    expect(hasStrongRepoGraphDrivers(weak)).toBe(false);
    expect(
      deriveCheckRunPolicy(weak, { baseline: false }).showRepoGraphContext,
    ).toBe(false);

    const strong = minimalResult({
      explain: {
        reasons: [
          {
            id: "graph.depth",
            layer: "ecosystem",
            title: "Indirect dependency depth exceeds typical baseline",
            scoreImpact: 15,
          },
        ],
      },
    });
    expect(hasStrongRepoGraphDrivers(strong)).toBe(true);
    expect(
      deriveCheckRunPolicy(strong, { baseline: false }).showRepoGraphContext,
    ).toBe(true);
  });
});

describe("buildPrCheckRunSummaryMarkdown", () => {
  it("always includes dashboard footer link", () => {
    const md = buildPrCheckRunSummaryMarkdown({
      result: minimalResult(),
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
      baseline: false,
    });
    expect(md).toContain(
      `<a href="${ORIGIN}/scan/${SCAN_ID}" target="_blank" rel="noopener noreferrer">View full scan</a>`,
    );
  });

  it("baseline body omits repo graph score lines", () => {
    const md = buildPrCheckRunSummaryMarkdown({
      result: minimalResult({ totalScore: 68 }),
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
      baseline: true,
    });
    expect(md).not.toMatch(/68\/100/);
    expect(md).not.toMatch(/moderate risk/i);
    expect(md).not.toMatch(/Repository graph/i);
  });

  it("full mode omits unexplained score when drivers are weak", () => {
    const md = buildPrCheckRunSummaryMarkdown({
      result: minimalResult({
        totalScore: 68,
        explain: { reasons: [] },
        decision: { recommendation: "safe", confidence: "high", reasoning: [] },
      }),
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
      baseline: false,
    });
    expect(md).not.toMatch(/68\/100 —/);
  });

  it("shows baseline outcome when baseline and no actionable bullets", () => {
    const md = buildPrCheckRunSummaryMarkdown({
      result: minimalResult({
        insights: [],
        recommendations: [],
        findings: [],
        decision: {
          recommendation: "safe",
          confidence: "high",
          reasoning: [],
        },
        explain: { reasons: [] },
      }),
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
      baseline: true,
    });
    expect(md).toContain(
      "No actionable dependency concerns showed up for this PR",
    );
    expect(md).not.toMatch(/high-confidence/i);
    expect(md).not.toMatch(/did not emit/i);
  });

  it("does not include standalone changed packages list", () => {
    const md = buildPrCheckRunSummaryMarkdown({
      result: minimalResult({
        insights: [
          {
            type: "usage_risk",
            priority: "high",
            confidence: "likely",
            scope: "changed",
            message: "Runtime path may load updated semver helpers.",
            context: "src/version.ts",
            remediation: "Run integration tests for version parsing.",
          },
        ],
      }),
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
      baseline: false,
    });
    expect(md).not.toMatch(/^Changed packages:/m);
    expect(md).not.toMatch(/^@types\/semver/m);
  });

  it("caps action bullets and stays under soft char limit for fat ScanResult", () => {
    const fat: ScanResult = {
      ...minimalResult(),
      totalScore: 72,
      graphInsights: {
        maxDepth: 14,
        nodes: 2400,
        edges: 9000,
        deepest: Array.from({ length: 20 }, (_, i) => ({
          kind: "deep" as const,
          packageName: `pkg-${i}`,
          depth: 10 + i,
          direct: false,
          via: ["a", "b", "c"],
        })),
        hotspots: Array.from({ length: 12 }, (_, i) => ({
          kind: "hotspot" as const,
          packageName: `hot-${i}`,
          depth: 3,
          direct: false,
        })),
        vulnerable: Array.from({ length: 8 }, (_, i) => ({
          kind: "vulnerable" as const,
          packageName: `vuln-${i}`,
          depth: 2,
          direct: false,
        })),
      },
      insights: Array.from({ length: 30 }, (_, i) => ({
        type: "behavioral_change" as const,
        priority: "high" as const,
        confidence: "confirmed" as const,
        scope: "changed" as const,
        message: `Insight message ${i} with extra detail about runtime behavior and dependency coupling.`,
        context: `src/module-${i}/index.ts`,
        remediation: `Remediation step ${i} including verify, test, and document.`,
      })),
      recommendations: Array.from({ length: 25 }, (_, i) => ({
        id: `rec-${i}`,
        title: `Recommendation title ${i}`,
        rationale: `Long rationale ${i} explaining ecosystem overlap and transitive churn in multiple sentences.`,
        impact: "high" as const,
        packages: [`pkg-a-${i}`, `pkg-b-${i}`],
      })),
      explain: {
        reasons: Array.from({ length: 40 }, (_, i) => ({
          id: `graph.metric.${i}`,
          layer: (["security", "maintainability", "ecosystem", "upgradeImpact"][
            i % 4
          ] ?? "ecosystem") as ScanResult["layerScores"] extends infer L
            ? keyof L
            : never,
          title: `graph.transitive volume cluster ${i}`,
          scoreImpact: 5 + i,
        })),
      },
    };

    const md = buildPrCheckRunSummaryMarkdown({
      result: fat,
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
      baseline: false,
    });

    expect(md).toContain("Insight message 0");
    expect(md).not.toContain("Insight message 3");
    const insightBullets = md
      .split("\n")
      .filter((l) => l.includes("Insight message"));
    expect(insightBullets.length).toBeLessThanOrEqual(
      CHECK_RUN_MAX_ACTION_BULLETS,
    );
    expect(md.length).toBeLessThanOrEqual(CHECK_RUN_SOFT_MAX_CHARS);
    expect(md).not.toContain("pkg-0 is reached transitively");
    expect(md).not.toContain("topology");
    expect(md).not.toMatch(/moderate risk/i);
  });

  it("pairs layer scores with drivers in details when shown", () => {
    const md = buildPrCheckRunSummaryMarkdown({
      result: minimalResult({
        layerScores: {
          security: 0,
          maintainability: 45,
          ecosystem: 50,
          upgradeImpact: 10,
        },
        explain: {
          reasons: [
            {
              id: "maint.band",
              layer: "maintainability",
              title: "Stale releases on multiple direct dependencies",
              scoreImpact: 18,
            },
          ],
        },
        contributions: [
          {
            id: "maint-stale",
            layer: "maintainability",
            scoreImpact: 10,
          },
        ],
      }),
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
      baseline: false,
    });
    if (md.includes("Layer scores")) {
      expect(md).toMatch(/Maintainability.*\/100 -/);
      expect(md).not.toMatch(/\| Security \| 0 \|/);
    }
  });
});
