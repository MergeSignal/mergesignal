import { describe, expect, it } from "vitest";
import type { Assessment } from "../assessmentSchema.js";
import type { ScanResult } from "../types.js";
import { buildScanPresentationBundle, presentDashboardCard } from "./index.js";
import { buildGitHubCheckRunOutput } from "./buildGitHubCheckRunOutput.js";

const safeAssessment: Assessment = {
  posture: "safe",
  confidence: "high",
  primaryConcern: null,
  concerns: [],
  factors: ["tooling_maintenance"],
  changeClasses: ["tooling_maintenance"],
  presentation: {
    narrativeIntensity: "minimal",
    reachVisibility: "hidden",
    verificationIntensity: "advisory",
    insightEmissionFloor: "none",
    reportMode: "high_signal_pr",
  },
};

const baselineAssessment: Assessment = {
  posture: "safe",
  confidence: "medium",
  primaryConcern: "graph_baseline_only",
  concerns: [
    {
      kind: "graph_baseline_only",
      rank: 1,
      evidenceRefs: ["fixture:baseline"],
    },
  ],
  factors: ["graph_baseline_only"],
  changeClasses: ["tooling_maintenance"],
  presentation: {
    narrativeIntensity: "minimal",
    reachVisibility: "hidden",
    verificationIntensity: "none",
    insightEmissionFloor: "none",
    reportMode: "lightweight_pr_graph_baseline",
  },
};

const needsReviewAssessment: Assessment = {
  posture: "needs_review",
  confidence: "medium",
  primaryConcern: "confirmed_runtime_usage",
  concerns: [
    {
      kind: "confirmed_runtime_usage",
      rank: 1,
      packages: ["fastify"],
      evidenceRefs: ["fixture:fastify"],
    },
  ],
  factors: ["confirmed_runtime_usage", "http_framework_infrastructure"],
  changeClasses: ["runtime_upgrade"],
  presentation: {
    narrativeIntensity: "elevated",
    reachVisibility: "prominent",
    verificationIntensity: "required",
    insightEmissionFloor: "full",
    reportMode: "high_signal_pr",
  },
};

const riskyAssessment: Assessment = {
  posture: "risky",
  confidence: "high",
  primaryConcern: "breaking_or_major",
  concerns: [
    {
      kind: "breaking_or_major",
      rank: 1,
      packages: ["react"],
      evidenceRefs: ["fixture:breaking"],
    },
  ],
  factors: ["breaking_or_major"],
  changeClasses: ["breaking_change"],
  presentation: {
    narrativeIntensity: "elevated",
    reachVisibility: "prominent",
    verificationIntensity: "required",
    insightEmissionFloor: "full",
    reportMode: "high_signal_pr",
  },
};

function assertNoLegacyCheckRunMarkers(summary: string): void {
  expect(summary).not.toContain("Risk index");
  expect(summary).not.toContain("Layer scores");
  expect(summary).not.toContain("<details>");
  expect(summary).not.toMatch(/\d+\/100/);
}

function minimalScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    totalScore: 72,
    layerScores: {
      security: 10,
      maintainability: 20,
      ecosystem: 30,
      upgradeImpact: 15,
    },
    findings: [],
    methodologyVersion: "mergesignal-engine/test",
    generatedAt: new Date().toISOString(),
    assessment: safeAssessment,
    decision: {
      recommendation: "safe",
      confidence: "medium",
      reasoning: [],
    },
    ...overrides,
  };
}

describe("buildGitHubCheckRunOutput", () => {
  it("maps safe posture to success conclusion with scan link", () => {
    const out = buildGitHubCheckRunOutput(minimalScanResult(), {
      scanId: "scan-safe",
      webAppOrigin: "https://app.test",
    });
    expect(out.conclusion).toBe("success");
    expect(out.summary).toContain("/scan/scan-safe");
    expect(out.summary).toContain("Full scan:");
    assertNoLegacyCheckRunMarkers(out.summary);
  });

  it("maps needs_review posture to neutral conclusion", () => {
    const out = buildGitHubCheckRunOutput(
      minimalScanResult({
        assessment: needsReviewAssessment,
        decision: {
          recommendation: "needs_review",
          confidence: "medium",
          reasoning: ["Runtime usage confirmed"],
        },
        changedPackages: ["fastify"],
      }),
      { scanId: "scan-review", webAppOrigin: "https://app.test" },
    );
    expect(out.conclusion).toBe("neutral");
    expect(out.summary).toContain("/scan/scan-review");
    assertNoLegacyCheckRunMarkers(out.summary);
  });

  it("maps risky posture to failure conclusion", () => {
    const out = buildGitHubCheckRunOutput(
      minimalScanResult({
        assessment: riskyAssessment,
        decision: {
          recommendation: "risky",
          confidence: "high",
          reasoning: ["Breaking change"],
        },
      }),
      { scanId: "scan-risky", webAppOrigin: "https://app.test" },
    );
    expect(out.conclusion).toBe("failure");
    assertNoLegacyCheckRunMarkers(out.summary);
  });

  it("produces success conclusion for lightweight baseline presentation", () => {
    const out = buildGitHubCheckRunOutput(
      minimalScanResult({
        assessment: baselineAssessment,
        reportPresentation: { mode: "lightweight_pr_graph_baseline" },
        changedPackages: ["@types/minimist"],
        decision: {
          recommendation: "safe",
          confidence: "medium",
          reasoning: [],
        },
      }),
      { scanId: "scan-lw", webAppOrigin: "https://app.test" },
    );
    expect(out.conclusion).toBe("success");
    expect(out.summary).toContain("/scan/scan-lw");
    assertNoLegacyCheckRunMarkers(out.summary);
  });

  it("throws when assessment is missing", () => {
    expect(() =>
      buildGitHubCheckRunOutput(
        minimalScanResult({ assessment: undefined }),
        "scan-no-assessment",
      ),
    ).toThrow(/assessment/i);
  });

  it("title matches dashboard card headline from the same bundle", () => {
    const result = minimalScanResult({
      assessment: needsReviewAssessment,
      decision: {
        recommendation: "needs_review",
        confidence: "medium",
        reasoning: ["Runtime usage confirmed"],
      },
      changedPackages: ["fastify"],
    });
    const out = buildGitHubCheckRunOutput(result, {
      scanId: "scan-parity",
      webAppOrigin: "https://app.test",
    });
    const bundle = buildScanPresentationBundle({
      result,
      pipelineStatus: "done",
    });
    expect(bundle).not.toBeNull();
    const card = presentDashboardCard(bundle!);
    expect(out.title).toBe(card.headline);
  });
});
