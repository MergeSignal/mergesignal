import { describe, expect, it } from "vitest";
import type { Assessment } from "../assessment/types.js";
import {
  artifactGroundedScopeFor,
  minimalReviewFocalPoint,
  verificationScopeFor,
  withAssessmentScope,
} from "./fixtures/assessmentScopeFixtures.js";
import {
  assessmentFastifyRuntime,
  assessmentPrettier,
  assessmentTypescriptPatch,
} from "./fixtures/assessmentFixtures.js";
import type { ScanResult } from "./types.js";
import {
  collectArtifactVerificationFocus,
  collectRuntimeVerificationFocus,
  collectVerificationFocusForPresentation,
  resolveVerificationChannel,
} from "./assessmentProjection.js";
import { toPublicPresentation } from "./assessmentPresentationUtils.js";

function scanResultWithAssessment(assessment: Assessment): ScanResult {
  return {
    totalScore: 30,
    layerScores: {
      security: 10,
      maintainability: 10,
      ecosystem: 10,
      upgradeImpact: 0,
    },
    findings: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    assessment,
    decision: {
      recommendation: "safe",
      confidence: "high",
      reasoning: ["fixture"],
    },
    repoIntelligence: {},
    changedPackages: assessment.reviewFocalPoint.anchors,
  };
}

describe("resolveVerificationChannel", () => {
  it("maps intensity to presentation channel", () => {
    expect(resolveVerificationChannel("none")).toBe("none");
    expect(resolveVerificationChannel("advisory")).toBe("artifact");
    expect(resolveVerificationChannel("required")).toBe("runtime");
  });
});

describe("collectVerificationFocusForPresentation", () => {
  it("fastify required: runtime focus only", () => {
    const result = scanResultWithAssessment(assessmentFastifyRuntime);
    const presentation = toPublicPresentation(
      assessmentFastifyRuntime.presentation,
    );
    const projected = collectVerificationFocusForPresentation(
      presentation,
      result,
    );

    expect(projected.channel).toBe("runtime");
    expect(projected.focus).toEqual(["routes", "middleware"]);
    expect(collectRuntimeVerificationFocus(result)).toEqual(projected.focus);
    expect(collectArtifactVerificationFocus(result)).toEqual([]);
  });

  it("typescript advisory: artifact focus only", () => {
    const result = scanResultWithAssessment(assessmentTypescriptPatch);
    const presentation = toPublicPresentation(
      assessmentTypescriptPatch.presentation,
    );
    const projected = collectVerificationFocusForPresentation(
      presentation,
      result,
    );

    expect(projected.channel).toBe("artifact");
    expect(projected.focus).toEqual(["typecheck"]);
    expect(collectArtifactVerificationFocus(result)).toEqual(["typecheck"]);
    expect(collectRuntimeVerificationFocus(result)).toEqual([]);
  });

  it("prettier advisory: artifact focus only", () => {
    const result = scanResultWithAssessment(assessmentPrettier);
    const presentation = toPublicPresentation(assessmentPrettier.presentation);
    const projected = collectVerificationFocusForPresentation(
      presentation,
      result,
    );

    expect(projected.channel).toBe("artifact");
    expect(projected.focus).toEqual(["format"]);
  });

  it("none intensity: empty focus", () => {
    const assessment = withAssessmentScope(
      {
        ...assessmentTypescriptPatch,
        presentation: {
          ...assessmentTypescriptPatch.presentation,
          verificationIntensity: "none",
        },
      },
      {
        reviewFocalPoint: minimalReviewFocalPoint(["typescript"]),
        verificationScope: verificationScopeFor(
          ["fastify"],
          ["routes"],
          artifactGroundedScopeFor(["typescript"], ["typecheck"]),
        ),
      },
    );
    const result = scanResultWithAssessment(assessment);
    const projected = collectVerificationFocusForPresentation(
      toPublicPresentation(assessment.presentation),
      result,
    );

    expect(projected.channel).toBe("none");
    expect(projected.focus).toEqual([]);
  });

  it("conflict fixture: advisory uses artifact only", () => {
    const assessment = withAssessmentScope(
      {
        ...assessmentTypescriptPatch,
        presentation: {
          ...assessmentTypescriptPatch.presentation,
          verificationIntensity: "advisory",
        },
      },
      {
        reviewFocalPoint: minimalReviewFocalPoint(["typescript"]),
        verificationScope: verificationScopeFor(
          ["fastify"],
          ["routes"],
          artifactGroundedScopeFor(["typescript"], ["typecheck"]),
        ),
      },
    );
    const result = scanResultWithAssessment(assessment);
    const projected = collectVerificationFocusForPresentation(
      toPublicPresentation(assessment.presentation),
      result,
    );

    expect(projected.channel).toBe("artifact");
    expect(projected.focus).toEqual(["typecheck"]);
    expect(projected.focus).not.toContain("routes");
  });

  it("conflict fixture: required uses runtime only", () => {
    const assessment = withAssessmentScope(
      {
        ...assessmentFastifyRuntime,
        presentation: {
          ...assessmentFastifyRuntime.presentation,
          verificationIntensity: "required",
        },
      },
      {
        reviewFocalPoint: minimalReviewFocalPoint(["fastify"]),
        verificationScope: verificationScopeFor(
          ["fastify"],
          ["routes", "middleware"],
          artifactGroundedScopeFor(["typescript"], ["typecheck"]),
        ),
      },
    );
    const result = scanResultWithAssessment(assessment);
    const projected = collectVerificationFocusForPresentation(
      toPublicPresentation(assessment.presentation),
      result,
    );

    expect(projected.channel).toBe("runtime");
    expect(projected.focus).toEqual(["routes", "middleware"]);
    expect(projected.focus).not.toContain("typecheck");
  });
});
