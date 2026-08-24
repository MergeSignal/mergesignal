import { describe, expect, it } from "vitest";

import { withAbi4EngineScores } from "../fixtures/engineAbi4Fixtures.js";
import { safeParseEngineOutputScanResult } from "../scanResultSchema.js";
import { SUFFICIENCY_BLOCKER_KINDS } from "./literals.js";
import { assessmentSchema, parseAssessmentOrThrow } from "./schema.js";
import type { SufficiencyBlocker, SufficiencyBlockerKind } from "./types.js";

const baselineSufficiencyVerdict = {
  sufficient: false,
  clearanceEligible: false,
  provenBrokenEligible: false,
  boundedVerifyEligible: true,
  blockers: [] as SufficiencyBlocker[],
  perPackage: {
    "pkg-a": {
      packageName: "pkg-a",
      clearanceEligible: false,
      provenBrokenEligible: false,
      blockers: [] as SufficiencyBlocker[],
    },
  },
};

const minimalAssessmentWithSufficiency = (blockers: SufficiencyBlocker[]) => ({
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
  confidenceRationale: "Confidence is low due to proof-capability ceiling.",
  evidenceSufficiencyVerdict: {
    ...baselineSufficiencyVerdict,
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

describe("SUFFICIENCY_BLOCKER_KINDS", () => {
  it("includes proof_capability_ceiling without removing existing literals", () => {
    expect(SUFFICIENCY_BLOCKER_KINDS).toContain("proof_capability_ceiling");
    expect(SUFFICIENCY_BLOCKER_KINDS).toContain("proof_coverage_insufficient");
    expect(SUFFICIENCY_BLOCKER_KINDS).toContain(
      "repository_coverage_insufficient",
    );
    expect(SUFFICIENCY_BLOCKER_KINDS).toContain("proof_execution_failed");
  });

  it("keeps collection, routable-proof, and capability-ceiling blockers distinct", () => {
    const collectionIndex = SUFFICIENCY_BLOCKER_KINDS.indexOf(
      "repository_coverage_insufficient",
    );
    const routableProofIndex = SUFFICIENCY_BLOCKER_KINDS.indexOf(
      "proof_coverage_insufficient",
    );
    const capabilityCeilingIndex = SUFFICIENCY_BLOCKER_KINDS.indexOf(
      "proof_capability_ceiling",
    );

    expect(collectionIndex).toBeGreaterThanOrEqual(0);
    expect(routableProofIndex).toBeGreaterThanOrEqual(0);
    expect(capabilityCeilingIndex).toBeGreaterThanOrEqual(0);
    expect(new Set(SUFFICIENCY_BLOCKER_KINDS).size).toBe(
      SUFFICIENCY_BLOCKER_KINDS.length,
    );
  });
});

describe("proof_capability_ceiling sufficiency blocker wire contract", () => {
  const blocker: SufficiencyBlocker = {
    kind: "proof_capability_ceiling",
    packageName: "pkg-a",
    detail: "Governed proof capability declares exports scope unsupported.",
  };

  it("is accepted by the canonical assessment schema", () => {
    const parsed = assessmentSchema.safeParse(
      minimalAssessmentWithSufficiency([blocker]),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.evidenceSufficiencyVerdict?.blockers[0]?.kind).toBe(
        "proof_capability_ceiling",
      );
    }
  });

  it("is included in the inferred SufficiencyBlockerKind union", () => {
    const kind: SufficiencyBlockerKind = "proof_capability_ceiling";
    expect(kind).toBe("proof_capability_ceiling");
  });

  it("round-trips through parseAssessmentOrThrow", () => {
    const payload = minimalAssessmentWithSufficiency([blocker]);
    const parsed = parseAssessmentOrThrow(payload);
    const serialized = JSON.parse(JSON.stringify(parsed));
    const reparsed = parseAssessmentOrThrow(serialized);

    expect(reparsed.evidenceSufficiencyVerdict?.blockers).toEqual([
      {
        kind: "proof_capability_ceiling",
        packageName: "pkg-a",
        detail: "Governed proof capability declares exports scope unsupported.",
      },
    ]);
  });

  it("rejects unknown blocker kinds", () => {
    const parsed = assessmentSchema.safeParse(
      minimalAssessmentWithSufficiency([
        {
          kind: "unsupported_proof_capability_ceiling",
          packageName: "pkg-a",
        } as unknown as SufficiencyBlocker,
      ]),
    );
    expect(parsed.success).toBe(false);
  });

  it("is accepted through the trusted fresh-engine output parse boundary", () => {
    const r = safeParseEngineOutputScanResult(
      withAbi4EngineScores({
        totalScore: 42,
        layerScores: {
          security: 10,
          maintainability: 20,
          ecosystem: 30,
          upgradeImpact: 40,
        },
        findings: [],
        generatedAt: "2026-01-01T00:00:00.000Z",
        methodologyVersion: "engine-test-fixture/v1",
        assessment: minimalAssessmentWithSufficiency([blocker]),
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(
        r.result.assessment?.evidenceSufficiencyVerdict?.blockers[0]?.kind,
      ).toBe("proof_capability_ceiling");
    }
  });
});
