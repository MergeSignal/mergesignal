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
  primaryConcern: "unresolved_runtime_exposure" as const,
  concerns: [
    {
      kind: "unresolved_runtime_exposure" as const,
      rank: 1,
      packages: ["fastify"],
      evidenceRefs: ["semantics:fastify"],
    },
  ],
  factors: ["unresolved_runtime_exposure"],
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

  it("rejects removed confirmed_runtime_usage in primaryConcern", () => {
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      primaryConcern: "confirmed_runtime_usage",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects removed confirmed_runtime_usage in concerns[].kind", () => {
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      concerns: [
        {
          kind: "confirmed_runtime_usage",
          rank: 1,
          packages: ["fastify"],
          evidenceRefs: ["semantics:fastify"],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("parseAssessmentOrThrow rejects removed confirmed_runtime_usage in primaryConcern", () => {
    expect(() =>
      parseAssessmentOrThrow({
        ...minimalAbi3Assessment,
        primaryConcern: "confirmed_runtime_usage",
      }),
    ).toThrow();
  });

  it("accepts unresolved_runtime_exposure in primaryConcern and concerns", () => {
    const parsed = assessmentSchema.safeParse(minimalAbi3Assessment);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.primaryConcern).toBe("unresolved_runtime_exposure");
      expect(parsed.data.concerns[0]?.kind).toBe("unresolved_runtime_exposure");
    }
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
        kind: "unresolved_runtime_exposure",
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

function minimalProvenanceMember(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    fieldPath: "exports.foo",
    changeKind: "changed",
    ...overrides,
  };
}

function minimalProvenanceGroup(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    packageName: "pkg-a",
    dimensionKind: "exports",
    clearanceBasis: "no_impact_proven",
    noImpactProofKind: "no_imports",
    members: [minimalProvenanceMember()],
    ...overrides,
  };
}

function minimalProvenance(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    groups: [minimalProvenanceGroup()],
    ...overrides,
  };
}

describe("positiveClearanceProvenance (ABI 4 wire transport)", () => {
  it("accepts Assessment without positiveClearanceProvenance (historical compatibility)", () => {
    const parsed = assessmentSchema.safeParse(minimalAbi3Assessment);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.positiveClearanceProvenance).toBeUndefined();
    }
  });

  it("accepts ABI 4 Assessment without positiveClearanceProvenance", () => {
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      outcome: "cleared",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.positiveClearanceProvenance).toBeUndefined();
    }
  });

  it("parses and preserves a single provenance group with one member", () => {
    const provenance = minimalProvenance();
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      positiveClearanceProvenance: provenance,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.positiveClearanceProvenance).toEqual(provenance);
      const roundTrip = assessmentSchema.safeParse(parsed.data);
      expect(roundTrip.success).toBe(true);
      if (roundTrip.success) {
        expect(roundTrip.data.positiveClearanceProvenance).toEqual(provenance);
      }
    }
  });

  it("preserves all members in a provenance group", () => {
    const members = [
      minimalProvenanceMember({ fieldPath: "exports.a", changeKind: "added" }),
      minimalProvenanceMember({
        fieldPath: "exports.b",
        changeKind: "removed",
      }),
      minimalProvenanceMember({
        fieldPath: "exports.c",
        changeKind: "tightened",
      }),
    ];
    const provenance = minimalProvenance({
      groups: [minimalProvenanceGroup({ members })],
    });
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      positiveClearanceProvenance: provenance,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(
        parsed.data.positiveClearanceProvenance?.groups[0]?.members,
      ).toEqual(members);
    }
  });

  it("preserves multiple provenance groups", () => {
    const provenance = minimalProvenance({
      groups: [
        minimalProvenanceGroup({
          packageName: "pkg-a",
          dimensionKind: "exports",
        }),
        minimalProvenanceGroup({
          packageName: "pkg-b",
          dimensionKind: "manifest",
          noImpactProofKind: "upstream_intrinsic_non_consumer",
          manifestConsumerRelevance: "upstream_descriptive",
        }),
      ],
    });
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      positiveClearanceProvenance: provenance,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.positiveClearanceProvenance?.groups).toHaveLength(2);
      expect(
        parsed.data.positiveClearanceProvenance?.groups[1]?.packageName,
      ).toBe("pkg-b");
    }
  });

  it("accepts valid noImpactProofKind literals", () => {
    for (const kind of [
      "no_imports",
      "surface_not_consumed",
      "non_runtime_band",
      "constraint_axis_absent",
      "upstream_intrinsic_non_consumer",
    ]) {
      const parsed = assessmentSchema.safeParse({
        ...minimalAbi3Assessment,
        positiveClearanceProvenance: minimalProvenance({
          groups: [minimalProvenanceGroup({ noImpactProofKind: kind })],
        }),
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("rejects invalid noImpactProofKind", () => {
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      positiveClearanceProvenance: minimalProvenance({
        groups: [
          minimalProvenanceGroup({
            noImpactProofKind: "not_a_real_proof_kind",
          }),
        ],
      }),
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts valid changeKind literals on members", () => {
    for (const changeKind of [
      "added",
      "removed",
      "changed",
      "tightened",
      "relaxed",
    ]) {
      const parsed = assessmentSchema.safeParse({
        ...minimalAbi3Assessment,
        positiveClearanceProvenance: minimalProvenance({
          groups: [
            minimalProvenanceGroup({
              members: [minimalProvenanceMember({ changeKind })],
            }),
          ],
        }),
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("rejects invalid changeKind on members", () => {
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      positiveClearanceProvenance: minimalProvenance({
        groups: [
          minimalProvenanceGroup({
            members: [
              minimalProvenanceMember({
                changeKind: "mutated_beyond_recognition",
              }),
            ],
          }),
        ],
      }),
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts valid optional manifestConsumerRelevance", () => {
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      positiveClearanceProvenance: minimalProvenance({
        groups: [
          minimalProvenanceGroup({
            dimensionKind: "manifest",
            noImpactProofKind: "upstream_intrinsic_non_consumer",
            manifestConsumerRelevance: "configuration_axis",
          }),
        ],
      }),
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid manifestConsumerRelevance", () => {
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      positiveClearanceProvenance: minimalProvenance({
        groups: [
          minimalProvenanceGroup({
            manifestConsumerRelevance: "consumer_facing_runtime",
          }),
        ],
      }),
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts non-manifest group without manifestConsumerRelevance", () => {
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      positiveClearanceProvenance: minimalProvenance({
        groups: [
          minimalProvenanceGroup({
            dimensionKind: "exports",
            manifestConsumerRelevance: undefined,
          }),
        ],
      }),
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(
        parsed.data.positiveClearanceProvenance?.groups[0]
          ?.manifestConsumerRelevance,
      ).toBeUndefined();
    }
  });

  it("rejects malformed provenance member missing fieldPath", () => {
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      positiveClearanceProvenance: minimalProvenance({
        groups: [
          minimalProvenanceGroup({
            members: [{ changeKind: "added" }],
          }),
        ],
      }),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects malformed provenance group missing members", () => {
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      positiveClearanceProvenance: {
        groups: [
          {
            packageName: "pkg-a",
            dimensionKind: "exports",
            clearanceBasis: "no_impact_proven",
            noImpactProofKind: "no_imports",
          },
        ],
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects clearanceBasis other than no_impact_proven", () => {
    const parsed = assessmentSchema.safeParse({
      ...minimalAbi3Assessment,
      positiveClearanceProvenance: minimalProvenance({
        groups: [minimalProvenanceGroup({ clearanceBasis: "proof_pass" })],
      }),
    });
    expect(parsed.success).toBe(false);
  });
});

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
          kind: "unresolved_runtime_exposure",
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
