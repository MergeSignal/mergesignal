import type { Assessment } from "../assessment/types.js";
import { extractAuthoredCommunication } from "../assessment/authoredCommunication.js";
import { describe, expect, it } from "vitest";
import type { ScanResult } from "../types.js";
import {
  minimalReviewFocalPoint,
  reachScopeFor,
  verificationScopeFor,
  withAssessmentScope,
} from "../fixtures/assessmentScopeFixtures.js";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";

// ─── Vocabulary firewall ──────────────────────────────────────────────────────

/** Engine vocabulary that must never appear in any developer-facing authored string. */
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

// ─── Fixture helpers ──────────────────────────────────────────────────────────

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

function assessmentWithTrustLine(): Assessment {
  return withAssessmentScope(
    {
      posture: "safe",
      confidence: "high",
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
      reasoning: [
        "All peer dependency constraints verified — no runtime breakage confirmed.",
        "Export compatibility proven unused in this repository.",
      ],
      confidenceRationale:
        "Confidence is high: all assessed dimensions were verified by deterministic proof.",
    },
    {
      reviewFocalPoint: minimalReviewFocalPoint(["express"]),
      reachScope: reachScopeFor(["express"]),
      verificationScope: verificationScopeFor(["express"]),
    },
  );
}

function assessmentWithElectionSummary(): Assessment {
  return withAssessmentScope(
    {
      posture: "needs_review",
      confidence: "medium",
      primaryConcern: "confirmed_runtime_usage",
      concerns: [
        {
          kind: "confirmed_runtime_usage",
          rank: 1,
          packages: ["fastify"],
          evidenceRefs: [],
          context: "Runtime usage: `fastify` — used in HTTP request handling.",
        },
      ],
      factors: ["confirmed_runtime_usage"],
      changeClasses: ["runtime_upgrade"],
      presentation: {
        narrativeIntensity: "standard",
        reachVisibility: "contextual",
        verificationIntensity: "required",
        insightEmissionFloor: "full",
        reportMode: "high_signal_pr",
      },
      reasoning: [
        "fastify is used in HTTP request handling in this repository.",
      ],
      confidenceRationale:
        "Confidence is medium: runtime usage was observed but proof coverage is representative.",
      notAffectedLine: null,
      resolutionLine: null,
    },
    {
      reviewFocalPoint: {
        episodeShape: "single_anchor",
        anchors: ["fastify"],
        electionSummary:
          "`fastify` was selected as the review anchor over `fastify-plugin` due to higher runtime reach.",
        election: {
          grounding: [
            {
              packageName: "fastify",
              reason: "highest_runtime_reach",
              decidedBy: "reach",
              evidenceRefs: [],
            },
          ],
          exclusions: [
            {
              packageName: "fastify-plugin",
              reason: "lower_runtime_reach",
              lostOn: "reach",
              evidenceRefs: [],
            },
          ],
        },
      },
      reachScope: reachScopeFor(["fastify"]),
      verificationScope: verificationScopeFor(["fastify"]),
    },
  );
}

function assessmentUncontestedElection(): Assessment {
  return withAssessmentScope(
    {
      posture: "needs_review",
      confidence: "medium",
      primaryConcern: "confirmed_runtime_usage",
      concerns: [],
      factors: ["confirmed_runtime_usage"],
      changeClasses: ["runtime_upgrade"],
      presentation: {
        narrativeIntensity: "standard",
        reachVisibility: "contextual",
        verificationIntensity: "required",
        insightEmissionFloor: "full",
        reportMode: "high_signal_pr",
      },
      reasoning: ["express is used in HTTP request handling."],
      confidenceRationale:
        "Confidence is high: runtime usage was directly observed.",
    },
    {
      reviewFocalPoint: minimalReviewFocalPoint(["express"]),
      reachScope: reachScopeFor(["express"]),
      verificationScope: verificationScopeFor(["express"]),
    },
  );
}

function assessmentWithQ8Q9(): Assessment {
  return withAssessmentScope(
    {
      posture: "needs_review",
      confidence: "medium",
      primaryConcern: "confirmed_runtime_usage",
      concerns: [],
      factors: ["confirmed_runtime_usage"],
      changeClasses: ["runtime_upgrade"],
      outcome: "bounded_verify",
      presentation: {
        narrativeIntensity: "standard",
        reachVisibility: "contextual",
        verificationIntensity: "required",
        insightEmissionFloor: "full",
        reportMode: "high_signal_pr",
      },
      reasoning: ["Automation stopped before all dimensions were verified."],
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

// ─── V1 bundle transport ──────────────────────────────────────────────────────

describe("decision surface contract (V1) — bundle transport", () => {
  it("trustLine carries confidenceRationale verbatim from assessment", () => {
    const assessment = assessmentWithTrustLine();
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    });
    expect(bundle).not.toBeNull();
    expect(bundle!.trustLine).toBe(assessment.confidenceRationale);
  });

  it("whyThisPackageLine carries electionSummary verbatim when present", () => {
    const assessment = assessmentWithElectionSummary();
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    });
    expect(bundle!.whyThisPackageLine).toBe(
      assessment.reviewFocalPoint.electionSummary,
    );
  });

  it("whyThisPackageLine is null when electionSummary is absent", () => {
    const assessment = assessmentUncontestedElection();
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    });
    expect(bundle!.whyThisPackageLine).toBeNull();
  });

  it("reasoningLines and guidanceLines carry assessment arrays verbatim", () => {
    const assessment = assessmentWithQ8Q9();
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    });
    expect(bundle!.reasoningLines).toEqual(assessment.reasoning);
    expect(bundle!.guidanceLines).toEqual(
      assessment.verificationScope.guidance ?? [],
    );
  });

  it("notAffectedLine and resolutionLine survive parse and transport (Q8/Q9)", () => {
    const assessment = assessmentWithQ8Q9();
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    });
    expect(bundle!.notAffectedLine).toBe(assessment.notAffectedLine);
    expect(bundle!.resolutionLine).toBe(assessment.resolutionLine);
  });

  it("concernContextLines carries concerns[].context verbatim", () => {
    const assessment = assessmentWithElectionSummary();
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    });
    expect(bundle!.concernContextLines).toEqual([
      "Runtime usage: `fastify` — used in HTTP request handling.",
    ]);
  });

  it("public bundle accessors match extractAuthoredCommunication", () => {
    const assessment = assessmentWithQ8Q9();
    const normalized = assessment;
    const expected = extractAuthoredCommunication(normalized);
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    })!;
    expect(bundle.trustLine).toBe(expected.trustLine);
    expect(bundle.whyThisPackageLine).toBe(expected.whyThisPackageLine);
    expect(bundle.notAffectedLine).toBe(expected.notAffectedLine);
    expect(bundle.resolutionLine).toBe(expected.resolutionLine);
    expect(bundle.reasoningLines).toEqual(expected.reasoningLines);
    expect(bundle.guidanceLines).toEqual(expected.guidanceLines);
    expect(bundle.concernContextLines).toEqual(expected.concernContextLines);
  });
});

// ─── Vocabulary firewall ──────────────────────────────────────────────────────

describe("decision surface contract (V1) — vocabulary firewall on accessors", () => {
  function assertNoEngineVocabulary(
    strings: (string | null | undefined)[],
    context: string,
  ): void {
    for (const token of ENGINE_VOCABULARY) {
      for (const str of strings) {
        if (!str) continue;
        expect(
          str,
          `${context}: must not contain engine token "${token}"`,
        ).not.toContain(token);
      }
    }
  }

  it("bundle accessors carry no engine vocabulary", () => {
    const assessment = assessmentWithQ8Q9();
    const bundle = buildScanPresentationBundle({
      result: scanResultWith(assessment),
      pipelineStatus: "done",
    })!;
    assertNoEngineVocabulary(
      [
        bundle.trustLine,
        bundle.whyThisPackageLine,
        bundle.notAffectedLine,
        bundle.resolutionLine,
        ...bundle.reasoningLines,
        ...bundle.guidanceLines,
        ...bundle.concernContextLines,
      ],
      "bundle accessors",
    );
  });
});

// V3 surface delivery (Dashboard, Scan Details) is intentionally excluded from V1 graduation.
// See presentDashboardCard / presentScanDetails adoption in V3 Surface Adoption roadmap.
