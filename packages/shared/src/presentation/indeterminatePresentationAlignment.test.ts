import { describe, expect, it } from "vitest";
import type { Assessment, SufficiencyBlocker } from "../assessment/types.js";
import {
  emptyReachScope,
  emptyVerificationScope,
  minimalReviewFocalPoint,
  withAssessmentScope,
} from "../fixtures/assessmentScopeFixtures.js";
import {
  assessmentFastifyRuntime,
  assessmentGenericAbstain,
  assessmentLimitedContext,
  assessmentTypescriptPatch,
} from "../fixtures/assessmentFixtures.js";
import { buildGitHubCheckRunOutput } from "./buildGitHubCheckRunOutput.js";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
import { presentCliScanSummary } from "./presenters/presentCliScanSummary.js";
import { presentDashboardCard } from "./presenters/presentDashboardCard.js";
import { presentGitHubCheckRun } from "./presenters/presentGitHubCheckRun.js";
import { presentScanDetails } from "./presenters/presentScanDetails.js";
import { composeSubheadline } from "./compose/narrativeCompose.js";
import type { ScanResult } from "../types.js";
import { analysisPreparationWithValidRepoIntel } from "../fixtures/repoIntelligenceTestHelpers.js";
import { deriveScanNarrative } from "../deriveScanNarrative.js";
import { fixtureRepoIntelligenceFastify } from "../fixtures/repoIntelligenceFixtures.js";

const SCAN_ID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://app.example.com";
const LIMITED_CONTEXT_MESSAGE = "PR-specific scan context was limited";

const DEVELOPER_ATTENTION_FORBIDDEN =
  /\b(review|verify|test|check|investigate|fix)\b/i;

function indeterminateAssessment(
  overrides: Partial<Assessment> = {},
): Assessment {
  return withAssessmentScope(
    {
      posture: "indeterminate",
      outcome: "abstain",
      confidence: "low",
      primaryConcern: null,
      concerns: [],
      factors: [],
      changeClasses: ["runtime_upgrade"],
      presentation: {
        narrativeIntensity: "minimal",
        reachVisibility: "hidden",
        verificationIntensity: "none",
        insightEmissionFloor: "none",
        reportMode: "high_signal_pr",
      },
      reasoning: ["Governed analysis abstained without a concrete concern."],
      confidenceRationale: "Confidence is low.",
      ...overrides,
    },
    {
      reviewFocalPoint: minimalReviewFocalPoint(["pkg-a"]),
      reachScope: emptyReachScope(),
      verificationScope: emptyVerificationScope(),
    },
  );
}

function scanWithAssessment(
  assessment: Assessment,
  over: Partial<ScanResult> = {},
): ScanResult {
  return {
    totalScore: 42,
    layerScores: {
      security: 10,
      maintainability: 20,
      ecosystem: 30,
      upgradeImpact: 40,
    },
    prRisk: { availability: "indeterminate" },
    findings: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    methodologyVersion: "mergesignal-engine/test",
    changedPackages: ["pkg-a"],
    assessment,
    decision: {
      recommendation: "indeterminate",
      confidence: assessment.confidence,
      reasoning: [],
    },
    insights: [],
    recommendations: [],
    analysisPreparation: analysisPreparationWithValidRepoIntel(),
    repoIntelligence: fixtureRepoIntelligenceFastify,
    ...over,
  };
}

function surfacesFor(result: ScanResult) {
  const bundle = buildScanPresentationBundle({
    result,
    pipelineStatus: "done",
  })!;
  const card = presentDashboardCard(bundle);
  const details = presentScanDetails(bundle, { scanId: SCAN_ID });
  const check = presentGitHubCheckRun(bundle, {
    scanId: SCAN_ID,
    webAppOrigin: ORIGIN,
  });
  const cli = presentCliScanSummary(bundle, { repoLabel: "acme/api" });
  const subheadline = composeSubheadline(bundle);
  return { bundle, card, details, check, cli, subheadline };
}

function expectIndeterminateMergeSafetyHeadline(headline: string) {
  expect(headline).toMatch(/merge safety not established/i);
  expect(headline).not.toMatch(/could not be determined/i);
  expect(headline).not.toMatch(/Cannot determine/i);
  expect(headline).not.toMatch(/needs review/i);
  expect(headline).not.toMatch(DEVELOPER_ATTENTION_FORBIDDEN);
}

describe("indeterminate presentation alignment", () => {
  it("capability-ceiling indeterminate: neutral headline, no collection subheadline", () => {
    const blockers: SufficiencyBlocker[] = [
      {
        kind: "proof_capability_ceiling",
        packageName: "pkg-a",
        detail: "Governed proof capability declares exports scope unsupported.",
      },
    ];
    const assessment = indeterminateAssessment({
      reasoning: [
        "Exports-scope proof is unsupported under governed capability ceiling.",
        "No concrete repository-relevant concern was established.",
      ],
      confidenceRationale: "Confidence is low due to proof-capability ceiling.",
      evidenceSufficiencyVerdict: {
        sufficient: false,
        clearanceEligible: false,
        provenBrokenEligible: false,
        boundedVerifyEligible: false,
        blockers,
        perPackage: {
          "pkg-a": {
            packageName: "pkg-a",
            clearanceEligible: false,
            provenBrokenEligible: false,
            blockers,
          },
        },
      },
    });
    const result = scanWithAssessment(assessment);
    const s = surfacesFor(result);

    expectIndeterminateMergeSafetyHeadline(s.card.headline);
    expect(s.details.hero.headline).toBe(s.card.headline);
    expect(s.check.title).toBe(s.card.headline);
    expect(s.cli.headline).toBe(s.card.headline);
    expect(s.subheadline).toBeUndefined();
    expect(s.bundle.profile.degradedMessage).toBeUndefined();
    expect(s.check.conclusion).toBe("neutral");
    expect(s.card.reasoning).toEqual(assessment.reasoning);
    expect(s.card.verification).toEqual([]);
    expect(deriveScanNarrative(result).confidence.limitedContext).toBe(false);
  });

  it("insufficient-collection indeterminate: collection subheadline without capability wording", () => {
    const assessment = indeterminateAssessment({
      abstainReasons: [{ kind: "insufficient_collection", detail: "fixture" }],
      reasoning: ["Repository collection was incomplete for this scan."],
      confidenceRationale:
        "Confidence is low: evidence collection was limited.",
    });
    const result = scanWithAssessment(assessment);
    const s = surfacesFor(result);

    expectIndeterminateMergeSafetyHeadline(s.card.headline);
    expect(s.subheadline).toBe(LIMITED_CONTEXT_MESSAGE);
    expect(s.bundle.profile.degradedMessage).toBe(LIMITED_CONTEXT_MESSAGE);
    expect(s.card.headline).not.toMatch(/capability/i);
  });

  it("proof-coverage indeterminate: neutral headline without invented action", () => {
    const blockers: SufficiencyBlocker[] = [
      {
        kind: "proof_coverage_insufficient",
        packageName: "pkg-a",
        detail: "Required routable proof artifact is absent.",
      },
    ];
    const assessment = indeterminateAssessment({
      reasoning: ["Required routable proof coverage was not available."],
      confidenceRationale: "Confidence is low: proof coverage is insufficient.",
      evidenceSufficiencyVerdict: {
        sufficient: false,
        clearanceEligible: false,
        provenBrokenEligible: false,
        boundedVerifyEligible: false,
        blockers,
        perPackage: {
          "pkg-a": {
            packageName: "pkg-a",
            clearanceEligible: false,
            provenBrokenEligible: false,
            blockers,
          },
        },
      },
    });
    const result = scanWithAssessment(assessment);
    const s = surfacesFor(result);

    expectIndeterminateMergeSafetyHeadline(s.card.headline);
    expect(s.subheadline).toBeUndefined();
    expect(s.card.verification).toEqual([]);
    expect(s.card.reasoning).toEqual(assessment.reasoning);
  });

  it("no-honest-target indeterminate: neutral headline without collection subheadline", () => {
    const assessment = indeterminateAssessment({
      abstainReasons: [{ kind: "no_honest_bounded_target" }],
      reasoning: ["No honest bounded verification target was available."],
      confidenceRationale: "Confidence is low.",
    });
    const result = scanWithAssessment(assessment);
    const s = surfacesFor(result);

    expectIndeterminateMergeSafetyHeadline(s.card.headline);
    expect(s.subheadline).toBeUndefined();
    expect(s.bundle.profile.degradedMessage).toBeUndefined();
  });

  it("generic abstain fixture: neutral headline across consumers", () => {
    const result = scanWithAssessment(assessmentGenericAbstain);
    const s = surfacesFor(result);

    expectIndeterminateMergeSafetyHeadline(s.card.headline);
    expect(s.details.hero.headline).toBe(s.card.headline);
    expect(s.check.title).toBe(s.card.headline);
    expect(s.cli.headline).toBe(s.card.headline);
    expect(s.check.conclusion).toBe("neutral");
  });

  it("low confidence alone does not imply limited collection subheadline", () => {
    const assessment = indeterminateAssessment({
      confidence: "low",
      abstainReasons: undefined,
      evidenceSufficiencyVerdict: undefined,
    });
    const result = scanWithAssessment(assessment);
    const s = surfacesFor(result);

    expectIndeterminateMergeSafetyHeadline(s.card.headline);
    expect(s.bundle.profile.degradedMessage).toBeUndefined();
    expect(s.subheadline).toBeUndefined();
    expect(deriveScanNarrative(result).confidence.limitedContext).toBe(false);
  });

  it("insufficient-evidence needs_review: preserves collection-limited headline only", () => {
    const result = scanWithAssessment(assessmentLimitedContext, {
      changedPackages: ["lodash"],
      prRisk: { score: 72 },
      decision: {
        recommendation: "needs_review",
        confidence: "low",
        reasoning: ["Explicit human review warranted before merge."],
      },
    });
    const s = surfacesFor(result);

    expect(s.card.headline).toMatch(/limited scan context/i);
    expect(s.card.headline).not.toMatch(/merge safety not established/i);
    expect(s.subheadline).toBeUndefined();
    expect(s.bundle.profile.degradedMessage).toBeUndefined();
  });

  it("safe typescript patch: unchanged headline semantics", () => {
    const result = scanWithAssessment(assessmentTypescriptPatch, {
      changedPackages: ["typescript"],
      prRisk: { score: 18 },
      decision: {
        recommendation: "safe",
        confidence: "high",
        reasoning: [
          "No dedicated dependency review required beyond normal engineering process.",
        ],
      },
    });
    const s = surfacesFor(result);

    expect(s.card.headline).toMatch(/patch upgrade/i);
    expect(s.card.headline).not.toMatch(/merge safety not established/i);
    expect(s.card.verdict?.posture).toBe("safe");
  });

  it("risky fastify runtime: unchanged review headline and verification", () => {
    const result = scanWithAssessment(assessmentFastifyRuntime, {
      changedPackages: ["fastify"],
      prRisk: { score: 55 },
      decision: {
        recommendation: "needs_review",
        confidence: "medium",
        reasoning: [
          "Changed package upgrade leaves unresolved runtime exposure that warrants review before merge.",
        ],
      },
    });
    const s = surfacesFor(result);

    expect(s.card.headline).toMatch(/unresolved exposure/i);
    expect(s.card.verdict?.posture).toBe("needs_review");
    expect(s.card.verification.length).toBeGreaterThan(0);
    expect(s.card.headline).not.toMatch(/merge safety not established/i);
  });

  it("capability-ceiling GitHub check: title and body do not contradict", () => {
    const blockers: SufficiencyBlocker[] = [
      {
        kind: "proof_capability_ceiling",
        packageName: "pkg-a",
      },
    ];
    const assessment = indeterminateAssessment({
      reasoning: [
        "Exports-scope proof is unsupported under governed capability ceiling.",
      ],
      confidenceRationale: "Confidence is low due to proof-capability ceiling.",
      evidenceSufficiencyVerdict: {
        sufficient: false,
        clearanceEligible: false,
        provenBrokenEligible: false,
        boundedVerifyEligible: false,
        blockers,
        perPackage: {
          "pkg-a": {
            packageName: "pkg-a",
            clearanceEligible: false,
            provenBrokenEligible: false,
            blockers,
          },
        },
      },
    });
    const out = buildGitHubCheckRunOutput(scanWithAssessment(assessment), {
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
    });

    expectIndeterminateMergeSafetyHeadline(out.title);
    expect(out.conclusion).toBe("neutral");
    expect(out.summary).not.toContain(LIMITED_CONTEXT_MESSAGE);
    expect(out.summary).toContain(assessment.reasoning[0]);
  });

  it("legacy assessment without sufficiency verdict: conservative no collection subheadline", () => {
    const assessment = indeterminateAssessment({
      abstainReasons: undefined,
      evidenceSufficiencyVerdict: undefined,
      confidence: "low",
    });
    const result = scanWithAssessment(assessment);
    const s = surfacesFor(result);

    expectIndeterminateMergeSafetyHeadline(s.card.headline);
    expect(s.subheadline).toBeUndefined();
  });
});
