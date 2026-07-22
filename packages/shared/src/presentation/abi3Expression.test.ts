/**
 * Wave 2.D — ABI 3 expression validation.
 *
 * Validates that:
 * 1. projectReasoningLines reads from assessment.reasoning (ABI 3) when present
 * 2. projectVerificationActions returns assessment.verificationScope.guidance when present
 * 3. PR comment includes reviewFocalPoint.electionSummary when present
 * 4. Check run "Why" section uses assessment.reasoning lines directly
 * 5. No prohibited vocabulary appears in rendered surfaces
 * 6. assessment.reasoning takes priority over decision.reasoning
 */

import { describe, expect, it } from "vitest";
import type { Assessment } from "../../assessment/types.js";
import type { ScanResult } from "../types.js";
import {
  minimalReviewFocalPoint,
  reachScopeFor,
  verificationScopeFor,
  withAssessmentScope,
} from "../fixtures/assessmentScopeFixtures.js";
import {
  projectReasoningLines,
  projectVerificationActions,
} from "../assessmentProjection.js";
import { toPublicPresentation } from "../assessmentPresentationUtils.js";
import { projectAssessmentFields } from "./projectAssessmentFields.js";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
import { presentGitHubPrComment } from "./presenters/presentGitHubPrComment.js";
import { presentGitHubCheckRun } from "./presenters/presentGitHubCheckRun.js";
import { buildGitHubCheckRunOutput } from "./buildGitHubCheckRunOutput.js";
import { presentGitHubPrCommentMarkdownFromResult } from "../presentGitHubPrComment.js";

// ---------------------------------------------------------------------------
// ABI 3 — Canonical express/confirmed_runtime_usage fixture
// ---------------------------------------------------------------------------

const expressReasoning = [
  "express is used in HTTP request handling in this repository via middleware chains.",
  "Import paths to application entry points were directly observed.",
  "Verification is required: review HTTP route definitions and middleware implementation.",
];

const expressGuidance = [
  "Review HTTP route definitions and middleware implementation in src/app.ts and src/server.ts.",
  "Review handler implementations that use express routing.",
];

const expressElectionSummary =
  "express was selected as the primary review anchor because it has the highest repository reach among changed packages and confirmed runtime usage in HTTP request handling.";

const assessmentExpressAbi3: Assessment = withAssessmentScope(
  {
    posture: "needs_review",
    confidence: "high",
    primaryConcern: "confirmed_runtime_usage",
    concerns: [
      {
        kind: "confirmed_runtime_usage",
        rank: 1,
        packages: ["express"],
        evidenceRefs: ["fixture:express"],
        context:
          "express participates in HTTP request handling across 12 files.",
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
    reasoning: expressReasoning,
    confidenceRationale:
      "Confidence is high: propagation from express to application entry points was directly observed.",
  },
  {
    reviewFocalPoint: {
      ...minimalReviewFocalPoint(["express"]),
      electionSummary: expressElectionSummary,
    },
    reachScope: reachScopeFor(["express"], "high"),
    verificationScope: verificationScopeFor(
      ["express"],
      ["routes", "middleware"],
      undefined,
    ),
  },
);

const assessmentExpressAbi3WithGuidance: Assessment = {
  ...assessmentExpressAbi3,
  verificationScope: {
    ...assessmentExpressAbi3.verificationScope,
    guidance: expressGuidance,
  },
};

function scanResultWithAssessment(
  assessment: Assessment,
  overrides: Partial<ScanResult> = {},
): ScanResult {
  return {
    totalScore: 63,
    layerScores: {
      security: 10,
      maintainability: 20,
      ecosystem: 30,
      upgradeImpact: 15,
    },
    findings: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    changedPackages: ["express"],
    assessment,
    decision: {
      recommendation: "needs_review",
      confidence: "high",
      reasoning: ["Old generic decision reasoning — should not appear."],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// projectReasoningLines — ABI 3 priority
// ---------------------------------------------------------------------------

describe("projectReasoningLines — ABI 3", () => {
  it("returns assessment.reasoning when present (ABI 3 takes priority)", () => {
    const result = scanResultWithAssessment(assessmentExpressAbi3);
    const lines = projectReasoningLines(result);
    expect(lines).toEqual(expressReasoning);
  });

  it("assessment.reasoning takes priority over decision.reasoning", () => {
    const result = scanResultWithAssessment(assessmentExpressAbi3);
    const lines = projectReasoningLines(result);
    expect(lines).not.toContain(
      "Old generic decision reasoning — should not appear.",
    );
  });

  it("falls back to decision.reasoning when assessment.reasoning is empty", () => {
    const assessmentWithoutReasoning: Assessment = {
      ...assessmentExpressAbi3,
      reasoning: [],
    };
    const result = scanResultWithAssessment(assessmentWithoutReasoning);
    const lines = projectReasoningLines(result);
    expect(lines).toEqual([
      "Old generic decision reasoning — should not appear.",
    ]);
  });

  it("returns empty array when both reasoning sources are absent", () => {
    const assessmentEmpty: Assessment = {
      ...assessmentExpressAbi3,
      reasoning: [],
    };
    const result = scanResultWithAssessment(assessmentEmpty, {
      decision: {
        recommendation: "needs_review",
        confidence: "high",
        reasoning: [],
      },
    });
    const lines = projectReasoningLines(result);
    expect(lines).toEqual([]);
  });

  it("reasoning lines contain no prohibited vocabulary", () => {
    const result = scanResultWithAssessment(assessmentExpressAbi3);
    const lines = projectReasoningLines(result);
    const joined = lines.join(" ");
    const prohibited = [
      "qualityClass",
      "qualityBasis",
      "proofFingerprint",
      "observationId",
      "propagationQualityRank",
      "AssessmentEvidenceBundle",
      "DenseEvidenceHighlight",
      "will affect",
      "will break",
      "breaks compatibility",
      "remain compatible",
      "critical path",
    ];
    for (const term of prohibited) {
      expect(joined).not.toContain(term);
    }
  });
});

// ---------------------------------------------------------------------------
// projectVerificationActions — guidance priority
// ---------------------------------------------------------------------------

describe("projectVerificationActions — ABI 3 guidance", () => {
  const presentation = toPublicPresentation(
    assessmentExpressAbi3WithGuidance.presentation,
  );

  it("returns guidance prose when verificationScope.guidance is present", () => {
    const result = scanResultWithAssessment(assessmentExpressAbi3WithGuidance);
    const actions = projectVerificationActions(
      assessmentExpressAbi3WithGuidance,
      presentation,
      result,
      6,
    );
    expect(actions).toEqual(expressGuidance);
  });

  it("guidance respects max limit", () => {
    const result = scanResultWithAssessment(assessmentExpressAbi3WithGuidance);
    const actions = projectVerificationActions(
      assessmentExpressAbi3WithGuidance,
      presentation,
      result,
      1,
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toBe(expressGuidance[0]);
  });

  it("falls back to focus tokens when guidance is absent", () => {
    const result = scanResultWithAssessment(assessmentExpressAbi3);
    const actions = projectVerificationActions(
      assessmentExpressAbi3,
      presentation,
      result,
      6,
    );
    // No guidance — falls back to runtime focus tokens
    expect(actions).toEqual(expect.arrayContaining(["routes", "middleware"]));
  });

  it("returns empty when verificationIntensity is none", () => {
    const noneAssessment: Assessment = {
      ...assessmentExpressAbi3WithGuidance,
      presentation: {
        ...assessmentExpressAbi3WithGuidance.presentation,
        verificationIntensity: "none",
      },
    };
    const result = scanResultWithAssessment(noneAssessment);
    const actions = projectVerificationActions(
      noneAssessment,
      toPublicPresentation(noneAssessment.presentation),
      result,
      6,
    );
    expect(actions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// projectAssessmentFields — ABI 3 expression projection
// ---------------------------------------------------------------------------

describe("projectAssessmentFields — ABI 3 expression", () => {
  it("projects confidenceRationale and electionSummary from assessment", () => {
    const result = scanResultWithAssessment(assessmentExpressAbi3);
    const bundle = buildScanPresentationBundle({
      result,
      pipelineStatus: "done",
    })!;
    const fields = projectAssessmentFields(bundle);
    expect(fields.confidenceRationale).toBe(
      "Confidence is high: propagation from express to application entry points was directly observed.",
    );
    expect(fields.electionSummary).toBe(expressElectionSummary);
    expect(fields.reasoning).toEqual(expressReasoning);
  });

  it("omits empty confidenceRationale and electionSummary after trim", () => {
    const assessment: Assessment = {
      ...assessmentExpressAbi3,
      confidenceRationale: "   ",
      reviewFocalPoint: {
        ...assessmentExpressAbi3.reviewFocalPoint,
        electionSummary: "",
      },
    };
    const result = scanResultWithAssessment(assessment);
    const bundle = buildScanPresentationBundle({
      result,
      pipelineStatus: "done",
    })!;
    const fields = projectAssessmentFields(bundle);
    expect(fields.confidenceRationale).toBeUndefined();
    expect(fields.electionSummary).toBeUndefined();
  });

  it("projects reasoning when assessment has concerns", () => {
    const result = scanResultWithAssessment(assessmentExpressAbi3);
    const bundle = buildScanPresentationBundle({
      result,
      pipelineStatus: "done",
    })!;
    const fields = projectAssessmentFields(bundle);
    expect(assessmentExpressAbi3.concerns.length).toBeGreaterThan(0);
    expect(fields.reasoning.length).toBeGreaterThan(0);
    expect(fields.reasoning).toEqual(expressReasoning);
  });
});

// ---------------------------------------------------------------------------
// PR comment — electionSummary and reasoning
// ---------------------------------------------------------------------------

describe("presentGitHubPrComment — ABI 3 expression", () => {
  function buildBundle(assessment: Assessment) {
    const result = scanResultWithAssessment(assessment, {
      changedPackages: ["express"],
    });
    return buildScanPresentationBundle({ result, pipelineStatus: "done" })!;
  }

  it("introLines include electionSummary when present", () => {
    const bundle = buildBundle(assessmentExpressAbi3);
    const comment = presentGitHubPrComment(bundle);
    expect(comment.introLines).toContain(expressElectionSummary);
  });

  it("introLines include assessment.reasoning sentences", () => {
    const bundle = buildBundle(assessmentExpressAbi3);
    const comment = presentGitHubPrComment(bundle);
    const joined = comment.introLines.join(" ");
    expect(joined).toContain("express is used in HTTP request handling");
    expect(joined).toContain("Import paths to application entry points");
  });

  it("electionSummary is absent from introLines when not set", () => {
    const assessmentNoElection: Assessment = {
      ...assessmentExpressAbi3,
      reviewFocalPoint: {
        ...assessmentExpressAbi3.reviewFocalPoint,
        electionSummary: undefined,
      },
    };
    const bundle = buildBundle(assessmentNoElection);
    const comment = presentGitHubPrComment(bundle);
    expect(comment.introLines).not.toContain(expressElectionSummary);
  });

  it("introLines contain no prohibited vocabulary", () => {
    const bundle = buildBundle(assessmentExpressAbi3);
    const comment = presentGitHubPrComment(bundle);
    const joined = comment.introLines.join(" ");
    const prohibited = [
      "qualityClass",
      "qualityBasis",
      "proofFingerprint",
      "observationId",
      "propagationQualityRank",
    ];
    for (const term of prohibited) {
      expect(joined).not.toContain(term);
    }
  });
});

// ---------------------------------------------------------------------------
// Check run — Why section uses assessment.reasoning
// ---------------------------------------------------------------------------

describe("presentGitHubCheckRun — ABI 3 Why section", () => {
  const SCAN_ID = "scan-abi3-test";
  const ORIGIN = "https://app.test";

  function buildBundle(assessment: Assessment) {
    const result = scanResultWithAssessment(assessment, {
      changedPackages: ["express"],
    });
    return buildScanPresentationBundle({ result, pipelineStatus: "done" })!;
  }

  it("Why section bullets come from assessment.reasoning (ABI 3)", () => {
    const bundle = buildBundle(assessmentExpressAbi3);
    const checkRun = presentGitHubCheckRun(bundle, {
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
    });
    const whySection = checkRun.sections.find(
      (s) => s.id === "why" && s.title === "Why",
    );
    expect(whySection).toBeDefined();
    expect(whySection!.bullets).toEqual(
      expect.arrayContaining([
        "express is used in HTTP request handling in this repository via middleware chains.",
      ]),
    );
  });

  it("Why section does not contain old generic decision reasoning", () => {
    const bundle = buildBundle(assessmentExpressAbi3);
    const checkRun = presentGitHubCheckRun(bundle, {
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
    });
    const whySection = checkRun.sections.find(
      (s) => s.id === "why" && s.title === "Why",
    );
    const bulletText = whySection?.bullets.join(" ") ?? "";
    expect(bulletText).not.toContain("Old generic decision reasoning");
  });

  it("check run summary contains no prohibited vocabulary", () => {
    const result = scanResultWithAssessment(assessmentExpressAbi3, {
      changedPackages: ["express"],
      methodologyVersion: "mergesignal-engine/test",
    });
    const output = buildGitHubCheckRunOutput(result, {
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
    });
    const prohibited = [
      "qualityClass",
      "qualityBasis",
      "proofFingerprint",
      "observationId",
      "propagationQualityRank",
      "AssessmentEvidenceBundle",
    ];
    for (const term of prohibited) {
      expect(output.summary).not.toContain(term);
    }
  });

  it("Why section respects 3-line limit", () => {
    const bundle = buildBundle(assessmentExpressAbi3);
    const checkRun = presentGitHubCheckRun(bundle, {
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
    });
    const whySection = checkRun.sections.find((s) => s.title === "Why");
    if (whySection) {
      expect(whySection.bullets.length).toBeLessThanOrEqual(3);
    }
  });
});

// ---------------------------------------------------------------------------
// End-to-end markdown snapshot — PR comment with ABI 3 fixture
// ---------------------------------------------------------------------------

describe("PR comment markdown — ABI 3 end-to-end", () => {
  it("rendered markdown includes repository-specific reasoning", () => {
    const result = scanResultWithAssessment(assessmentExpressAbi3, {
      changedPackages: ["express"],
    });
    const markdown = presentGitHubPrCommentMarkdownFromResult(result);
    expect(markdown).toContain("express is used in HTTP request handling");
    expect(markdown).toContain("Import paths to application entry points");
  });

  it("rendered markdown includes electionSummary", () => {
    const result = scanResultWithAssessment(assessmentExpressAbi3, {
      changedPackages: ["express"],
    });
    const markdown = presentGitHubPrCommentMarkdownFromResult(result);
    expect(markdown).toContain(
      "express was selected as the primary review anchor",
    );
  });

  it("rendered markdown contains no prohibited vocabulary", () => {
    const result = scanResultWithAssessment(assessmentExpressAbi3, {
      changedPackages: ["express"],
    });
    const markdown = presentGitHubPrCommentMarkdownFromResult(result);
    const prohibited = [
      "qualityClass",
      "qualityBasis",
      "proofFingerprint",
      "observationId",
      "propagationQualityRank",
      "AssessmentEvidenceBundle",
      "DenseEvidenceHighlight",
    ];
    for (const term of prohibited) {
      expect(markdown).not.toContain(term);
    }
  });
});
