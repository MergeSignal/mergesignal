import { describe, expect, it } from "vitest";
import type { Assessment } from "../assessment/types.js";
import type { ScanResult } from "../types.js";
import {
  minimalReviewFocalPoint,
  withAssessmentScope,
  emptyReachScope,
  emptyVerificationScope,
} from "../fixtures/assessmentScopeFixtures.js";
import { assessmentGenericAbstain } from "../fixtures/assessmentFixtures.js";
import { buildGitHubCheckRunOutput } from "./buildGitHubCheckRunOutput.js";
import { presentationStatusFromAssessment } from "./presentationStatusFromAssessment.js";
import { presentScanDetails } from "./presenters/presentScanDetails.js";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
import { formatPrRiskSummary } from "../prRiskBand.js";
import { deriveRiskSignals } from "../riskSignals.js";
import { deriveScanNarrative } from "../deriveScanNarrative.js";
import { MERGE_POSTURE_LABEL } from "../riskVocabulary.js";

function abstainAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return withAssessmentScope(
    {
      posture: "risky",
      outcome: "abstain",
      confidence: "low",
      primaryConcern: "insufficient_evidence",
      concerns: [],
      factors: [],
      changeClasses: [],
      presentation: {
        narrativeIntensity: "minimal",
        reachVisibility: "hidden",
        verificationIntensity: "none",
        insightEmissionFloor: "none",
        reportMode: "high_signal_pr",
      },
      reasoning: ["Deterministic analysis could not reach a conclusion."],
      confidenceRationale: "Confidence is low: evidence was insufficient.",
      abstainReasons: [{ kind: "insufficient_collection", detail: "fixture" }],
      ...overrides,
    },
    {
      reviewFocalPoint: minimalReviewFocalPoint(["pkg-a"]),
      reachScope: emptyReachScope(),
      verificationScope: emptyVerificationScope(),
    },
  );
}

function scanWithAssessment(assessment: Assessment): ScanResult {
  return {
    totalScore: 92,
    layerScores: {
      security: 90,
      maintainability: 90,
      ecosystem: 90,
      upgradeImpact: 90,
    },
    prRisk: { score: 92 },
    findings: [],
    generatedAt: "2026-01-01T00:00:00Z",
    methodologyVersion: "mergesignal-engine/test",
    changedPackages: ["pkg-a"],
    assessment,
    decision: {
      recommendation: "needs_review",
      confidence: "low",
      reasoning: [],
    },
    insights: [],
  };
}

describe("abstention presentation semantics", () => {
  it("maps abstain outcome to indeterminate presentation status", () => {
    const assessment = abstainAssessment();
    expect(presentationStatusFromAssessment(assessment)).toBe("indeterminate");
  });

  it("uses outcome over legacy risky posture for historical abstain rows", () => {
    const assessment = abstainAssessment({ posture: "risky" });
    expect(presentationStatusFromAssessment(assessment)).toBe("indeterminate");
    expect(assessment.posture).toBe("risky");
  });

  it("does not render numeric PR Risk for abstain despite legacy stored score", () => {
    const result = scanWithAssessment(abstainAssessment());
    expect(deriveRiskSignals(result)).toBeNull();
    expect(formatPrRiskSummary(deriveScanNarrative(result))).toBeUndefined();
  });

  it("maps abstain to neutral GitHub check conclusion", () => {
    const out = buildGitHubCheckRunOutput(
      scanWithAssessment(abstainAssessment()),
      {
        scanId: "scan-abstain",
        webAppOrigin: "https://app.test",
      },
    );
    expect(out.conclusion).toBe("neutral");
  });

  it("labels abstain as Cannot determine", () => {
    expect(MERGE_POSTURE_LABEL.indeterminate).toBe("Cannot determine");
  });

  it("accepts indeterminate recommendation on decision wire", () => {
    const result = scanWithAssessment(abstainAssessment());
    const fresh = {
      ...result,
      assessment: abstainAssessment({ posture: "indeterminate" }),
      decision: {
        recommendation: "indeterminate" as const,
        confidence: "low" as const,
        reasoning: [],
      },
      prRisk: { availability: "indeterminate" as const },
    };
    expect(fresh.decision.recommendation).toBe("indeterminate");
    expect(fresh.prRisk).toEqual({ availability: "indeterminate" });
  });

  it("generic abstain: indeterminate headline without review homework", () => {
    const assessment = assessmentGenericAbstain;
    const result = scanWithAssessment(assessment);
    const bundle = buildScanPresentationBundle({
      result: {
        ...result,
        decision: {
          recommendation: "indeterminate",
          confidence: "low",
          reasoning: [],
        },
        prRisk: { availability: "indeterminate" },
        insights: [],
        recommendations: [],
      },
      pipelineStatus: "done",
    })!;
    const details = presentScanDetails(bundle, {
      scanId: "scan-generic-abstain",
    });

    expect(presentationStatusFromAssessment(assessment)).toBe("indeterminate");
    expect(details.posture).toBe("indeterminate");
    expect(details.hero.headline).toMatch(/merge safety not established/i);
    expect(details.hero.headline).not.toMatch(/needs review/i);
    expect(details.verificationFocus).toEqual([]);
  });

  it("generic abstain: GitHub check neutral with uncertainty headline", () => {
    const result = scanWithAssessment(assessmentGenericAbstain);
    const out = buildGitHubCheckRunOutput(
      {
        ...result,
        decision: {
          recommendation: "indeterminate",
          confidence: "low",
          reasoning: [],
        },
        prRisk: { availability: "indeterminate" },
        insights: [],
        recommendations: [],
      },
      {
        scanId: "scan-generic-abstain",
        webAppOrigin: "https://app.test",
      },
    );
    expect(out.conclusion).toBe("neutral");
    expect(out.title).toMatch(/merge safety not established/i);
    expect(out.title).not.toMatch(/needs review/i);
  });
});
