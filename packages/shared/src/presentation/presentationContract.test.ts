import type { Assessment } from "../assessment/types.js";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types.js";
import {
  minimalReviewFocalPoint,
  reachScopeFor,
  verificationScopeFor,
  withAssessmentScope,
} from "../fixtures/assessmentScopeFixtures.js";
import { normalizeGeneratedText } from "../normalizeGeneratedText.js";
import { scanSurfaceCopy } from "../scanSurfaceCopy.js";
import { buildNarrativeChannels } from "./compose/narrativeCompose.js";
import { buildScanDetailsPresentation } from "./orchestration/buildScanDetailsPresentation.js";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
import { presentScanDetails } from "./presenters/presentScanDetails.js";
import { presentationStatusFromAssessment } from "./presentationStatusFromAssessment.js";

const ENGINE_VOCABULARY = [
  "constraint_satisfiability",
  "lockfile_integrity",
  "type_surface_compatibility",
  "export_resolution",
  "peer_dependency",
  "engine_constraint",
  "no_impact_proven",
  "proof_pass",
  "bounded_verify",
  "representative_precision_only",
  "architectural_precision_only",
  "correlation_abstained",
  "clearanceEnvelope",
  "coverageClass",
  "precisionLevel",
  "proofArtifact",
  "packageOutcome",
  "qualityClass",
  "qualityBasis",
  "proofFingerprint",
  "observationId",
  "dimension_verification",
] as const;

const SCAN_ID = "11111111-1111-4111-8111-111111111111";

const PRIMARY_AUTHORED_REASONING =
  "Automation stopped before all dimensions were verified.";
const DETAIL_ONLY_REASONING =
  "Seventh authored reasoning line omitted from compact capacity.";

function scanResultWith(assessment: Assessment): ScanResult {
  return {
    totalScore: 70,
    layerScores: {
      security: 70,
      maintainability: 70,
      ecosystem: 70,
      upgradeImpact: 70,
    },
    findings: [],
    generatedAt: "2026-01-01T00:00:00Z",
    changedPackages: assessment.reviewFocalPoint.anchors,
    methodologyVersion: "mergesignal-engine/test",
    assessment,
    decision: {
      recommendation: "needs_review",
      confidence: "medium",
      reasoning: [],
    },
    insights: [],
  };
}

function assessmentWithAuthoredDetailLines(): Assessment {
  return withAssessmentScope(
    {
      posture: "needs_review",
      confidence: "medium",
      primaryConcern: "unresolved_runtime_exposure",
      concerns: [],
      factors: ["unresolved_runtime_exposure"],
      changeClasses: ["runtime_upgrade"],
      outcome: "bounded_verify",
      presentation: {
        narrativeIntensity: "standard",
        reachVisibility: "contextual",
        verificationIntensity: "required",
        insightEmissionFloor: "full",
        reportMode: "high_signal_pr",
      },
      reasoning: [PRIMARY_AUTHORED_REASONING],
      confidenceRationale:
        "Confidence is medium: bounded verification is required.",
      notAffectedLine:
        "No repository code paths are affected by export compatibility — this dimension is outside the review scope.",
      resolutionLine:
        "A passing automated verification for this dimension would make this deterministic.",
    },
    {
      reviewFocalPoint: minimalReviewFocalPoint(["express"]),
      reachScope: reachScopeFor(["express"]),
      verificationScope: {
        packages: ["express"],
        focus: [],
        guidance: ["Verify route handler at `src/server.ts:42`."],
      },
    },
  );
}

function assessmentWithManyAuthoredReasoningLines(): Assessment {
  return withAssessmentScope(
    {
      posture: "needs_review",
      confidence: "medium",
      primaryConcern: null,
      concerns: [],
      factors: [],
      changeClasses: ["runtime_upgrade"],
      presentation: {
        narrativeIntensity: "standard",
        reachVisibility: "hidden",
        verificationIntensity: "none",
        insightEmissionFloor: "full",
        reportMode: "high_signal_pr",
      },
      reasoning: [
        "First compact-eligible authored reasoning.",
        "Second compact-eligible authored reasoning.",
        "Third compact-eligible authored reasoning.",
        "Fourth compact-eligible authored reasoning.",
        "Fifth compact-eligible authored reasoning.",
        "Sixth compact-eligible authored reasoning.",
        DETAIL_ONLY_REASONING,
      ],
      confidenceRationale: "Confidence is medium.",
    },
    {
      reviewFocalPoint: minimalReviewFocalPoint(["pkg-a"]),
      reachScope: reachScopeFor(["pkg-a"]),
      verificationScope: verificationScopeFor(["pkg-a"]),
    },
  );
}

function assessmentWithoutAuthoredVerdictLines(
  overrides: Partial<Assessment> = {},
): Assessment {
  return withAssessmentScope(
    {
      posture: "needs_review",
      confidence: "medium",
      primaryConcern: "unresolved_runtime_exposure",
      concerns: [],
      factors: ["unresolved_runtime_exposure"],
      changeClasses: ["runtime_upgrade"],
      presentation: {
        narrativeIntensity: "standard",
        reachVisibility: "contextual",
        verificationIntensity: "required",
        insightEmissionFloor: "full",
        reportMode: "high_signal_pr",
      },
      reasoning: [],
      confidenceRationale: "Confidence is medium.",
      resolutionLine: null,
      notAffectedLine: null,
      ...overrides,
    },
    {
      reviewFocalPoint: minimalReviewFocalPoint(["express"]),
      reachScope: reachScopeFor(["express"]),
      verificationScope: verificationScopeFor(["express"]),
    },
  );
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key];
    if (
      child !== null &&
      typeof child === "object" &&
      !Object.isFrozen(child)
    ) {
      deepFreeze(child);
    }
  }
  return value;
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (value === null || value === undefined) {
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out);
    }
    return out;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value)) {
      collectStrings(v, out);
    }
  }
  return out;
}

function assertNoEngineVocabulary(strings: string[], context: string): void {
  for (const token of ENGINE_VOCABULARY) {
    for (const str of strings) {
      expect(
        str.toLowerCase().includes(token.toLowerCase()),
        `${context}: "${str}" must not contain engine token "${token}"`,
      ).toBe(false);
    }
  }
}

function expectVerdictWithoutConcernLabelSubstitute(
  detail: ReturnType<typeof presentScanDetails>,
  expectedLine: string,
): void {
  expect(detail.hero.verdictLine).toBe(normalizeGeneratedText(expectedLine));
  expect(detail.hero.verdictLine).not.toMatch(/unresolved runtime exposure/i);
}

describe("public presentation contract", () => {
  it("does not mutate frozen ScanResult during presentation build", () => {
    const assessment = assessmentWithAuthoredDetailLines();
    const result = scanResultWith(assessment);
    const before = structuredClone(result);
    deepFreeze(result);
    deepFreeze(result.assessment!);

    buildScanDetailsPresentation({
      scanId: SCAN_ID,
      pipelineStatus: "done",
      result,
    });

    expect(result).toEqual(before);
  });

  it("projects bundle accessors onto ScanDetailsPresentation", () => {
    const assessment = assessmentWithAuthoredDetailLines();
    const result = scanResultWith(assessment);
    const bundle = buildScanPresentationBundle({
      result,
      pipelineStatus: "done",
    })!;
    const detail = presentScanDetails(bundle, { scanId: SCAN_ID });

    expect(detail.reasoning).toEqual([...bundle.reasoningLines]);
    expect(detail.confidenceRationale).toBe(bundle.trustLine);
    expect(detail.resolutionLine).toBe(bundle.resolutionLine);
    expect(detail.notAffectedLine).toBe(bundle.notAffectedLine);
  });

  it("passes Assessment status through presentation profile unchanged", () => {
    for (const posture of [
      "safe",
      "needs_review",
      "risky",
      "indeterminate",
    ] as const) {
      const assessment = withAssessmentScope(
        {
          posture,
          outcome: posture === "indeterminate" ? "abstain" : undefined,
          confidence: "medium",
          primaryConcern: null,
          concerns: [],
          factors: [],
          changeClasses: [],
          presentation: {
            narrativeIntensity: "standard",
            reachVisibility: "contextual",
            verificationIntensity: "none",
            insightEmissionFloor: "full",
            reportMode: "high_signal_pr",
          },
          reasoning: ["Governed reasoning line."],
          confidenceRationale: "Confidence is medium.",
        },
        {
          reviewFocalPoint: minimalReviewFocalPoint(["pkg-a"]),
          reachScope: reachScopeFor(["pkg-a"]),
          verificationScope: verificationScopeFor(["pkg-a"]),
        },
      );
      const bundle = buildScanPresentationBundle({
        result: scanResultWith(assessment),
        pipelineStatus: "done",
      })!;
      const detail = presentScanDetails(bundle, { scanId: SCAN_ID });
      expect(detail.status).toBe(presentationStatusFromAssessment(assessment));
    }
  });

  it("does not let PR Risk availability change indeterminate Assessment status", () => {
    const assessment = withAssessmentScope(
      {
        posture: "indeterminate",
        outcome: "abstain",
        confidence: "low",
        primaryConcern: null,
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
        reasoning: ["Governed analysis abstained."],
        confidenceRationale: "Confidence is low.",
      },
      {
        reviewFocalPoint: minimalReviewFocalPoint(["pkg-a"]),
        reachScope: reachScopeFor(["pkg-a"]),
        verificationScope: verificationScopeFor(["pkg-a"]),
      },
    );
    const result: ScanResult = {
      ...scanResultWith(assessment),
      prRisk: {
        score: 88,
        band: "high",
        availability: "indeterminate",
        layers: [],
      },
    };
    const detail = buildScanDetailsPresentation({
      scanId: SCAN_ID,
      pipelineStatus: "done",
      result,
      prRiskScore: 88,
    })!;
    expect(detail.status).toBe("indeterminate");
    expect(detail.signalSummary).toBeUndefined();
  });

  it("keeps engine vocabulary off ScanDetailsPresentation string fields", () => {
    const assessment = assessmentWithAuthoredDetailLines();
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    })!;
    const detail = presentScanDetails(bundle, { scanId: SCAN_ID });
    assertNoEngineVocabulary(collectStrings(detail), "ScanDetailsPresentation");
  });

  it("preserves full authored reasoning on detail while compact keyPoints omit without inventing", () => {
    const assessment = assessmentWithManyAuthoredReasoningLines();
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    })!;
    const channels = buildNarrativeChannels(bundle);
    const detail = presentScanDetails(bundle, { scanId: SCAN_ID });

    expect(detail.reasoning).toEqual([...bundle.reasoningLines]);
    expect(detail.reasoning).toHaveLength(7);
    expect(detail.narrative.keyPoints.length).toBeLessThanOrEqual(6);

    const compactText = detail.narrative.keyPoints.join("\n");
    expect(compactText).not.toContain(DETAIL_ONLY_REASONING);

    const governedInsightCorpus = channels.insights.map((line) =>
      normalizeGeneratedText(line),
    );
    for (const keyPoint of detail.narrative.keyPoints) {
      expect(governedInsightCorpus).toContain(keyPoint);
    }
  });

  it("omits detail-only authored lines from compact keyPoints while keeping them on detail", () => {
    const assessment = assessmentWithAuthoredDetailLines();
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    })!;
    const detail = presentScanDetails(bundle, { scanId: SCAN_ID });

    expect(detail.reasoning).toEqual([PRIMARY_AUTHORED_REASONING]);
    expect(detail.resolutionLine).toBe(
      "A passing automated verification for this dimension would make this deterministic.",
    );
    expect(detail.notAffectedLine).toBe(
      "No repository code paths are affected by export compatibility — this dimension is outside the review scope.",
    );

    const compactText = detail.narrative.keyPoints.join("\n");
    expect(compactText).not.toContain(detail.resolutionLine!);
    expect(compactText).not.toContain(detail.notAffectedLine!);
  });

  it("uses first authored reasoning line for hero verdict when reasoning is present", () => {
    const assessment = assessmentWithAuthoredDetailLines();
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    })!;
    const detail = presentScanDetails(bundle, { scanId: SCAN_ID });
    expect(detail.hero.verdictLine).toBe(
      normalizeGeneratedText(PRIMARY_AUTHORED_REASONING),
    );
  });

  it("uses resolutionLine for hero verdict when reasoning is empty", () => {
    const assessment = assessmentWithoutAuthoredVerdictLines({
      resolutionLine: "Resolution line from engine.",
      notAffectedLine: null,
    });
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    })!;
    const detail = presentScanDetails(bundle, { scanId: SCAN_ID });
    expectVerdictWithoutConcernLabelSubstitute(
      detail,
      "Resolution line from engine.",
    );
  });

  it("uses notAffectedLine for hero verdict when reasoning and resolutionLine are absent", () => {
    const notAffectedLine =
      "No repository code paths are affected by export compatibility — this dimension is outside the review scope.";
    const assessment = assessmentWithoutAuthoredVerdictLines({
      resolutionLine: null,
      notAffectedLine,
    });
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    })!;
    const detail = presentScanDetails(bundle, { scanId: SCAN_ID });
    expectVerdictWithoutConcernLabelSubstitute(detail, notAffectedLine);
  });

  it("uses governed headline for hero verdict when authored verdict lines are absent", () => {
    const assessment = assessmentWithoutAuthoredVerdictLines();
    const expectedHeadline =
      scanSurfaceCopy.presentation.unresolvedRuntimeExposureHeadline
        .replace("{package}", "express")
        .replace("{surface}", "application code");
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    })!;
    const detail = presentScanDetails(bundle, { scanId: SCAN_ID });
    expect(detail.hero.verdictLine).toBe(
      normalizeGeneratedText(expectedHeadline),
    );
    expect(detail.hero.headline).toBe(normalizeGeneratedText(expectedHeadline));
  });
});
