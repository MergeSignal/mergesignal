import { describe, expect, it } from "vitest";
import { primaryPrExample } from "./productMessaging.js";
import {
  deriveScanDetailRecommendations,
  RECOMMENDATION_MAX_ITEMS,
} from "./deriveScanDetailRecommendations.js";
import { deriveScanDetailViewModel } from "./scanDetailViewModel.js";
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
    ...overrides,
  };
}

describe("deriveScanDetailRecommendations", () => {
  it("always returns 1–3 enriched items with detail fields", () => {
    const archetypes: ScanResult[] = [
      {
        ...baseResult,
        decision: { recommendation: "safe", confidence: "high", reasoning: [] },
      },
      minimalResult(),
      {
        ...minimalResult(),
        decision: {
          recommendation: "risky",
          confidence: "high",
          reasoning: [],
        },
        findings: [
          {
            id: "f1",
            severity: "critical",
            title: "Critical vulnerability",
            description: "Transitive CVE",
            packageName: "lodash",
            recommendation: "Upgrade lodash",
          },
        ],
      },
    ];

    for (const result of archetypes) {
      const center = deriveScanDetailRecommendations(result);
      expect(center.items.length).toBeGreaterThanOrEqual(1);
      expect(center.items.length).toBeLessThanOrEqual(RECOMMENDATION_MAX_ITEMS);
      expect(center.defaultSelectedId).toBe(center.items[0]?.id);
      for (const item of center.items) {
        expect(item.detail.why.length).toBeGreaterThan(0);
        expect(item.detail.whyNow.length).toBeGreaterThan(0);
        expect(item.detail.expectedBenefit.length).toBeGreaterThan(0);
        expect(item.detail.why).not.toMatch(/CVE-\d|@\d|\d+\.\d+\.\d+/);
      }
    }
  });

  it("quiet safe scan uses posture playbook with scan context", () => {
    const center = deriveScanDetailRecommendations({
      ...baseResult,
      decision: { recommendation: "safe", confidence: "high", reasoning: [] },
    });
    expect(center.posture).toBe("safe");
    expect(center.scanContext).toBeTruthy();
    expect(center.items[0]?.priority).toBe("low");
    expect(center.items[0]?.title).toBe("Merge normally");
  });

  it("duplicate recommendation includes whyNow and signals with packages", () => {
    const center = deriveScanDetailRecommendations({
      ...minimalResult(),
      recommendations: [
        {
          id: "r1",
          title: "Reduce duplicate dependency versions",
          rationale: "semver overlap",
          impact: "high",
          packages: ["semver", "string-width", "@opentelemetry/api-logs"],
        },
      ],
    });
    const dup = center.items.find((i) =>
      i.title.toLowerCase().includes("duplicate"),
    );
    expect(dup?.detail.whyNow.toLowerCase()).toContain("semver");
    expect(dup?.detail.signals.length).toBeGreaterThan(0);
    expect(dup?.detail.affectedPackages?.names).toContain("semver");
  });

  it("insight-rich scan has high priority and scan-specific whyNow", () => {
    const center = deriveScanDetailRecommendations({
      ...minimalResult(),
      insights: [
        {
          type: "behavioral_change",
          priority: "high",
          confidence: "confirmed",
          scope: "changed",
          message: primaryPrExample.message,
          context: primaryPrExample.where[0]!,
          remediation:
            "Confirm auth guards still run before protected handlers",
          affectedFiles: [...primaryPrExample.where],
        },
      ],
    });
    expect(center.items[0]?.source).toBe("insight");
    expect(center.items[0]?.priority).toBe("high");
    expect(center.items[0]?.detail.whyNow).toContain("middleware");
  });

  it("risky scan with critical findings leads with resolve guidance", () => {
    const center = deriveScanDetailRecommendations({
      ...minimalResult(),
      decision: { recommendation: "risky", confidence: "high", reasoning: [] },
      findings: [
        {
          id: "f1",
          severity: "critical",
          title: "Critical vulnerability",
          description: "Transitive CVE",
          packageName: "lodash",
          recommendation: "Upgrade lodash",
        },
      ],
    });
    expect(center.items[0]?.title).toContain("Resolve critical findings");
    expect(center.items[0]?.priority).toBe("high");
    expect(center.items[0]?.proofRefs?.findingIds).toContain("f1");
  });
});

describe("recommendedActions on scan detail view model", () => {
  it("includes recommendedActions slice on done scans", () => {
    const vm = deriveScanDetailViewModel(minimalResult(), {
      scanId: "s1",
      status: "done",
    });
    expect(vm?.recommendedActions.items.length).toBeGreaterThanOrEqual(1);
  });

  it("strips duplicate finding recommendations covered by recommended actions", () => {
    const vm = deriveScanDetailViewModel(
      {
        ...minimalResult(),
        decision: {
          recommendation: "risky",
          confidence: "high",
          reasoning: [],
        },
        findings: [
          {
            id: "f1",
            severity: "critical",
            title: "Critical vulnerability",
            description: "Transitive CVE",
            packageName: "lodash",
            recommendation: "Upgrade lodash",
          },
        ],
      },
      { scanId: "dedupe", status: "done" },
    );

    const finding = vm?.evidence?.findings.find((f) => f.id === "f1");
    expect(finding?.recommendation).toBeUndefined();
    expect(finding?.coveredByRecommendationRank).toBeGreaterThan(0);
  });

  it("does not expose Act 4 next steps", () => {
    const vm = deriveScanDetailViewModel(minimalResult(), {
      scanId: "s1",
      status: "done",
    });
    expect(vm).not.toHaveProperty("next");
  });
});
