import { describe, expect, it } from "vitest";

import { buildScanPresentationBundle } from "../presentation/orchestration/buildScanPresentationBundle.js";
import { safeParseEngineOutputScanResult } from "../scanResultSchema.js";
import { UNCLEARED_REASONS } from "./literals.js";
import { assessmentSchema, parseAssessmentOrThrow } from "./schema.js";
import type {
  Assessment,
  UnclearedDimension,
  UnclearedReason,
} from "./types.js";
import { ASSESSMENT_ABI } from "./version.js";

const baselineAssessmentFields = {
  reviewFocalPoint: {
    episodeShape: "single_anchor" as const,
    anchors: ["pkg-a"],
    election: { grounding: [], exclusions: [] },
  },
  reachScope: { packages: ["pkg-a"], maxBucket: "moderate" as const },
  verificationScope: { packages: ["pkg-a"], focus: ["pkg-a"] },
  posture: "indeterminate" as const,
  confidence: "low" as const,
  primaryConcern: null,
  concerns: [],
  factors: [],
  changeClasses: [] as const,
  presentation: {
    narrativeIntensity: "standard" as const,
    reachVisibility: "contextual" as const,
    verificationIntensity: "none" as const,
    insightEmissionFloor: "explain_only" as const,
    reportMode: "high_signal_pr" as const,
  },
  reasoning: ["Evidence is insufficient for clearance."],
  confidenceRationale: "Confidence is low due to correlation abstention.",
};

function minimalAssessmentWithClearance(
  unclearedDimensions: UnclearedDimension[],
) {
  return {
    ...baselineAssessmentFields,
    outcome: "bounded_verify" as const,
    clearanceEnvelopes: {
      "pkg-a": {
        packageName: "pkg-a",
        clearedDimensions: [],
        unclearedDimensions,
        coverageClass: "representative" as const,
      },
    },
  };
}

describe("UNCLEARED_REASONS", () => {
  it("includes correlation_abstained without removing existing literals", () => {
    expect(UNCLEARED_REASONS).toContain("correlation_abstained");
    expect(UNCLEARED_REASONS).toContain("proof_failed");
    expect(UNCLEARED_REASONS).toContain("no_producer_available");
    expect(UNCLEARED_REASONS).toContain("representative_precision_only");
    expect(UNCLEARED_REASONS).toContain("hypothesized_breaking");
  });

  it("keeps each uncleared reason distinct", () => {
    expect(new Set(UNCLEARED_REASONS).size).toBe(UNCLEARED_REASONS.length);
  });
});

describe("correlation_abstained Clearance Envelope wire contract", () => {
  const uncleared: UnclearedDimension = {
    kind: "exports",
    reason: "correlation_abstained",
  };

  it("keeps ASSESSMENT_ABI at 4", () => {
    expect(ASSESSMENT_ABI).toBe("4");
  });

  it("is accepted by the canonical assessment schema", () => {
    const parsed = assessmentSchema.safeParse(
      minimalAssessmentWithClearance([uncleared]),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(
        parsed.data.clearanceEnvelopes?.["pkg-a"]?.unclearedDimensions[0]
          ?.reason,
      ).toBe("correlation_abstained");
    }
  });

  it("is included in the inferred UnclearedReason union", () => {
    const reason: UnclearedReason = "correlation_abstained";
    expect(reason).toBe("correlation_abstained");
  });

  it("round-trips through parseAssessmentOrThrow", () => {
    const payload = minimalAssessmentWithClearance([uncleared]);
    const parsed = parseAssessmentOrThrow(payload);
    const serialized = JSON.parse(JSON.stringify(parsed));
    const reparsed = parseAssessmentOrThrow(serialized);

    expect(reparsed.clearanceEnvelopes?.["pkg-a"]?.unclearedDimensions).toEqual(
      [{ kind: "exports", reason: "correlation_abstained" }],
    );
  });

  it("rejects unknown uncleared reasons", () => {
    const parsed = assessmentSchema.safeParse(
      minimalAssessmentWithClearance([
        {
          kind: "exports",
          reason: "non_import_consumption_not_joined",
        } as unknown as UnclearedDimension,
      ]),
    );
    expect(parsed.success).toBe(false);
  });

  it("continues to accept existing uncleared reasons", () => {
    const parsed = assessmentSchema.safeParse(
      minimalAssessmentWithClearance([
        { kind: "peer_dependency", reason: "representative_precision_only" },
      ]),
    );
    expect(parsed.success).toBe(true);
  });

  it("is accepted through the trusted fresh-engine output parse boundary", () => {
    const r = safeParseEngineOutputScanResult(
      {
        findings: [],
        generatedAt: "2026-01-01T00:00:00.000Z",
        methodologyVersion: "engine-test-fixture/v1",
        assessment: minimalAssessmentWithClearance([uncleared]),
        decision: {
          recommendation: "indeterminate",
          confidence: "low",
          reasoning: [],
        },
        prRisk: { availability: "indeterminate" },
        repositoryHealth: {
          totalScore: 42,
          layerScores: {
            security: 10,
            maintainability: 20,
            ecosystem: 30,
            upgradeImpact: 40,
          },
        },
      },
      "change_request",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(
        r.result.assessment?.clearanceEnvelopes?.["pkg-a"]
          ?.unclearedDimensions[0]?.reason,
      ).toBe("correlation_abstained");
    }
  });

  it("does not break buildScanPresentationBundle when present on clearance envelope", () => {
    const assessment = parseAssessmentOrThrow(
      minimalAssessmentWithClearance([uncleared]),
    ) as Assessment;
    const bundle = buildScanPresentationBundle({
      result: {
        findings: [],
        generatedAt: "2026-01-01T00:00:00.000Z",
        methodologyVersion: "engine-test-fixture/v1",
        assessment,
        decision: {
          recommendation: "indeterminate",
          confidence: "low",
          reasoning: [],
        },
        prRisk: { availability: "indeterminate" },
        repositoryHealth: {
          totalScore: 42,
          layerScores: {
            security: 10,
            maintainability: 20,
            ecosystem: 30,
            upgradeImpact: 40,
          },
        },
      },
      pipelineStatus: "done",
    });
    expect(bundle).not.toBeNull();
  });
});
