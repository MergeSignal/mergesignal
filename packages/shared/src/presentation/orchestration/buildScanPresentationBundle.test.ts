import { parseAssessmentOrThrow } from "../../assessment/schema.js";
import { describe, expect, it } from "vitest";
import {
  emptyReachScope,
  emptyVerificationScope,
  minimalReviewFocalPoint,
} from "../../fixtures/assessmentScopeFixtures.js";
import { assessmentTypescriptPatch } from "../../fixtures/assessmentFixtures.js";
import type { ScanResult } from "../../types.js";
import { buildScanCardPresentation } from "./buildScanCardPresentation.js";
import { buildScanPresentationBundle } from "./buildScanPresentationBundle.js";

const abi1Assessment = {
  posture: "safe" as const,
  confidence: "high" as const,
  primaryConcern: null,
  concerns: [],
  factors: ["tooling_maintenance"],
  changeClasses: ["tooling_maintenance" as const],
  presentation: {
    narrativeIntensity: "minimal" as const,
    reachVisibility: "hidden" as const,
    verificationIntensity: "advisory" as const,
    insightEmissionFloor: "none" as const,
    reportMode: "high_signal_pr" as const,
  },
} as unknown as ScanResult["assessment"];

function minimalScanResult(assessment: ScanResult["assessment"]): ScanResult {
  return {
    totalScore: 42,
    layerScores: {
      security: 10,
      maintainability: 20,
      ecosystem: 30,
      upgradeImpact: 40,
    },
    findings: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    decision: {
      recommendation: "safe",
      confidence: "high",
      reasoning: [],
    },
    assessment,
  };
}

describe("buildScanPresentationBundle (presentation boundary)", () => {
  it("ABI-2 assessment produces a bundle", () => {
    const result = minimalScanResult(assessmentTypescriptPatch);
    const bundle = buildScanPresentationBundle({
      result,
      pipelineStatus: "done",
    });
    expect(bundle).not.toBeNull();
    expect(bundle!.assessment.reviewFocalPoint.anchors).toContain("typescript");
  });

  it("ABI-2 assessment renders a dashboard card headline", () => {
    const result = minimalScanResult(assessmentTypescriptPatch);
    const card = buildScanCardPresentation({
      pipelineStatus: "done",
      result,
    });
    expect(card.headline.length).toBeGreaterThan(0);
  });

  it("ABI-1 assessment returns null without throwing", () => {
    const result = minimalScanResult(abi1Assessment);
    expect(() =>
      buildScanPresentationBundle({
        result,
        pipelineStatus: "done",
      }),
    ).not.toThrow();
    expect(
      buildScanPresentationBundle({
        result,
        pipelineStatus: "done",
      }),
    ).toBeNull();
  });

  it("ABI-1 assessment does not mutate stored assessment JSON", () => {
    const result = minimalScanResult(structuredClone(abi1Assessment));
    const before = JSON.stringify(result.assessment);
    buildScanPresentationBundle({ result, pipelineStatus: "done" });
    expect(JSON.stringify(result.assessment)).toBe(before);
    expect(result.assessment).not.toHaveProperty("reviewFocalPoint");
  });

  it("ABI-1 direct parseAssessmentOrThrow still throws (contracts strict)", () => {
    expect(() => parseAssessmentOrThrow(abi1Assessment)).toThrow();
  });

  it("mixed PR index: ABI-2 ok and ABI-1 degraded without throw", () => {
    const abi2 = minimalScanResult(assessmentTypescriptPatch);
    const abi1 = minimalScanResult(abi1Assessment);
    for (const result of [abi2, abi1]) {
      expect(() =>
        buildScanCardPresentation({
          pipelineStatus: "done",
          result,
        }),
      ).not.toThrow();
    }
    const abi2Card = buildScanCardPresentation({
      pipelineStatus: "done",
      result: abi2,
    });
    const abi1Card = buildScanCardPresentation({
      pipelineStatus: "done",
      result: abi1,
    });
    expect(abi2Card.headline.length).toBeGreaterThan(0);
    expect(abi1Card.pipeline?.status).toBe("failed");
  });
});
