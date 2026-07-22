import { describe, expect, it } from "vitest";

import { extractAuthoredCommunication } from "./authoredCommunication.js";
import {
  assessmentSchema,
  parseAssessmentOrThrow,
  safeParseAssessment,
} from "./schema.js";
import type { Assessment } from "./types.js";
import { ASSESSMENT_ABI } from "./version.js";

const minimalAbi3Assessment = {
  reviewFocalPoint: {
    episodeShape: "single_anchor" as const,
    anchors: ["fastify"],
    election: {
      grounding: [
        {
          packageName: "fastify",
          reason: "Highest reach among eligible packages",
          decidedBy: "reach" as const,
          evidenceRefs: ["reach:fastify:moderate"],
        },
      ],
      exclusions: [],
    },
  },
  reachScope: {
    packages: ["fastify"],
    maxBucket: "moderate" as const,
  },
  verificationScope: {
    packages: ["fastify"],
    focus: ["fastify"],
  },
  posture: "needs_review" as const,
  confidence: "medium" as const,
  primaryConcern: "confirmed_runtime_usage" as const,
  concerns: [
    {
      kind: "confirmed_runtime_usage" as const,
      rank: 1,
      packages: ["fastify"],
      evidenceRefs: ["semantics:fastify"],
    },
  ],
  factors: ["confirmed_runtime_usage"],
  changeClasses: ["runtime_upgrade" as const],
  presentation: {
    narrativeIntensity: "standard" as const,
    reachVisibility: "contextual" as const,
    verificationIntensity: "advisory" as const,
    insightEmissionFloor: "full" as const,
    reportMode: "high_signal_pr" as const,
  },
  reasoning: [
    "fastify is used in HTTP request handling in this repository via middleware chains.",
  ],
  confidenceRationale:
    "Confidence is medium: fastify has confirmed structural runtime exposure.",
};

const abi1ShapedAssessment = {
  posture: "safe" as const,
  confidence: "high" as const,
  primaryConcern: null,
  concerns: [],
  factors: ["tooling_maintenance"],
  changeClasses: ["tooling_maintenance" as const],
  presentation: {
    narrativeIntensity: "minimal" as const,
    reachVisibility: "hidden" as const,
    verificationIntensity: "none" as const,
    insightEmissionFloor: "explain_only" as const,
    reportMode: "lightweight_pr_graph_baseline" as const,
  },
};

describe("ASSESSMENT_ABI", () => {
  it("is ABI 4 (Outcome model era)", () => {
    expect(ASSESSMENT_ABI).toBe("4");
  });
});

describe("assessmentSchema (ABI 4 — backward-compatible)", () => {
  it("accepts a minimal valid ABI 3 Assessment", () => {
    const parsed = assessmentSchema.safeParse(minimalAbi3Assessment);
    expect(parsed.success).toBe(true);
  });

  it("rejects ABI 3 payload missing required reasoning field", () => {
    const { reasoning: _reasoning, ...withoutReasoning } =
      minimalAbi3Assessment;
    const parsed = assessmentSchema.safeParse(withoutReasoning);
    expect(parsed.success).toBe(false);
  });

  it("rejects ABI 1-shaped payload missing focal/scope fields", () => {
    const parsed = assessmentSchema.safeParse(abi1ShapedAssessment);
    expect(parsed.success).toBe(false);
  });

  it("parseAssessmentOrThrow returns typed Assessment", () => {
    const value = parseAssessmentOrThrow(minimalAbi3Assessment);
    expect(value.reviewFocalPoint.anchors).toEqual(["fastify"]);
    expect(value.reasoning).toHaveLength(1);
    expect(value.confidenceRationale).toBeTruthy();
  });

  it("safeParseAssessment returns issues for invalid payload", () => {
    const result = safeParseAssessment(abi1ShapedAssessment);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.includes("reviewFocalPoint"))).toBe(
        true,
      );
    }
  });

  it("accepts ABI 3 payload without outcome model fields (backward-compat)", () => {
    const parsed = assessmentSchema.safeParse(minimalAbi3Assessment);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.outcome).toBeUndefined();
      expect(parsed.data.boundedVerifyTargets).toBeUndefined();
      expect(parsed.data.clearanceEnvelopes).toBeUndefined();
    }
  });

  it("preserves ABI 4 clearance envelope dimensions", () => {
    const withAbi4 = {
      ...minimalAbi3Assessment,
      outcome: "bounded_verify" as const,
      clearanceEnvelopes: {
        fastify: {
          packageName: "fastify",
          clearedDimensions: [
            {
              kind: "peer_dependency" as const,
              basis: "proof_pass" as const,
              proofArtifactRef: "proof-abc",
            },
          ],
          unclearedDimensions: [
            {
              kind: "exports" as const,
              reason: "representative_precision_only" as const,
            },
          ],
          coverageClass: "representative" as const,
        },
      },
    };
    const parsed = assessmentSchema.safeParse(withAbi4);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(
        parsed.data.clearanceEnvelopes?.fastify?.clearedDimensions[0]?.kind,
      ).toBe("peer_dependency");
    }
  });
});

function minimalAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    reviewFocalPoint: {
      episodeShape: "single_anchor",
      anchors: ["pkg-a"],
      election: { grounding: [], exclusions: [] },
      electionSummary: "Anchor election summary.",
    },
    reachScope: { packages: ["pkg-a"], maxBucket: "moderate" },
    verificationScope: {
      packages: ["pkg-a"],
      focus: [],
      guidance: ["Verify something."],
    },
    posture: "needs_review",
    confidence: "medium",
    primaryConcern: null,
    concerns: [
      {
        kind: "confirmed_runtime_usage",
        rank: 1,
        packages: ["pkg-a"],
        evidenceRefs: [],
        context: "Context line.",
      },
    ],
    factors: [],
    changeClasses: [],
    presentation: {
      narrativeIntensity: "standard",
      reachVisibility: "contextual",
      verificationIntensity: "advisory",
      insightEmissionFloor: "full",
      reportMode: "high_signal_pr",
    },
    reasoning: ["Lead reasoning."],
    confidenceRationale: "Confidence rationale.",
    notAffectedLine: "Not affected line.",
    resolutionLine: "Resolution line.",
    ...overrides,
  };
}

describe("extractAuthoredCommunication", () => {
  it("copies all authored fields verbatim", () => {
    const assessment = minimalAssessment();
    const extracted = extractAuthoredCommunication(assessment);

    expect(extracted.trustLine).toBe(assessment.confidenceRationale);
    expect(extracted.whyThisPackageLine).toBe(
      assessment.reviewFocalPoint.electionSummary ?? null,
    );
    expect(extracted.notAffectedLine).toBe(assessment.notAffectedLine ?? null);
    expect(extracted.resolutionLine).toBe(assessment.resolutionLine ?? null);
    expect(extracted.reasoningLines).toEqual(assessment.reasoning);
    expect(extracted.guidanceLines).toEqual(
      assessment.verificationScope.guidance ?? [],
    );
    expect(extracted.concernContextLines).toEqual(["Context line."]);
  });

  it("omits concerns without context from concernContextLines", () => {
    const assessment = minimalAssessment({
      concerns: [
        {
          kind: "confirmed_runtime_usage",
          rank: 1,
          packages: ["pkg-a"],
          evidenceRefs: [],
        },
      ],
    });
    expect(
      extractAuthoredCommunication(assessment).concernContextLines,
    ).toEqual([]);
  });
});
