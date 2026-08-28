import { describe, it, expect } from "vitest";
import {
  normalizeEngineOutputAbi4,
  safeParseScanResult,
  parseScanResultOrThrow,
  scanResultSchema,
  safeParseEngineOutputScanResult,
  parseEngineOutputScanResultOrThrow,
} from "./scanResultSchema.js";
import {
  emptyReachScope,
  emptyVerificationScope,
  minimalReviewFocalPoint,
} from "./fixtures/assessmentScopeFixtures.js";

const layerScores = {
  security: 10,
  maintainability: 20,
  ecosystem: 30,
  upgradeImpact: 40,
};

const minimalValid = {
  totalScore: 42,
  layerScores,
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
};

const minimalAssessment = {
  reviewFocalPoint: minimalReviewFocalPoint(["typescript"]),
  reachScope: emptyReachScope(),
  verificationScope: emptyVerificationScope(),
  posture: "safe" as const,
  confidence: "high" as const,
  primaryConcern: null,
  concerns: [] as [],
  factors: ["tooling_maintenance"],
  changeClasses: ["tooling_maintenance" as const],
  reasoning: [],
  confidenceRationale: "",
  presentation: {
    narrativeIntensity: "minimal" as const,
    reachVisibility: "hidden" as const,
    verificationIntensity: "advisory" as const,
    insightEmissionFloor: "none" as const,
    reportMode: "high_signal_pr" as const,
  },
};

const modernRepositoryHealth = {
  totalScore: 42,
  layerScores,
};

const modernDecision = {
  recommendation: "safe" as const,
  confidence: "high" as const,
  reasoning: [] as string[],
};

function modernFreshEngineBase(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    methodologyVersion: "engine-test-fixture/v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    assessment: minimalAssessment,
    decision: modernDecision,
    prRisk: { availability: "indeterminate" as const },
    repositoryHealth: modernRepositoryHealth,
    findings: [],
    ...overrides,
  };
}

describe("scanResultSchema", () => {
  it("accepts a minimal valid payload", () => {
    const r = safeParseScanResult(minimalValid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.totalScore).toBe(42);
  });

  it("accepts historical payload without layerScores", () => {
    const r = safeParseScanResult({
      totalScore: 42,
      findings: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(r.ok).toBe(true);
  });

  it("accepts modern namespaced payload without root graph scores", () => {
    const r = safeParseScanResult(modernFreshEngineBase());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.totalScore).toBeUndefined();
      expect(r.result.repositoryHealth?.totalScore).toBe(42);
    }
  });

  it("preserves unknown top-level keys (passthrough)", () => {
    const r = safeParseScanResult({
      ...minimalValid,
      futureEngineField: { x: 1 },
    });
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(
        (r.result as { futureEngineField?: unknown }).futureEngineField,
      ).toEqual({
        x: 1,
      });
  });

  it("rejects out-of-range totalScore", () => {
    const r = safeParseScanResult({
      ...minimalValid,
      totalScore: 101,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects invalid decision.recommendation", () => {
    const r = safeParseScanResult({
      ...minimalValid,
      decision: { recommendation: "maybe", reasoning: [] },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects non-canonical merge posture tokens (e.g. proprietary uppercase)", () => {
    const r = safeParseScanResult({
      ...minimalValid,
      decision: { recommendation: "SAFE", reasoning: [] },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects empty generatedAt", () => {
    const r = safeParseScanResult({
      ...minimalValid,
      generatedAt: "",
    });
    expect(r.ok).toBe(false);
  });

  it("parseScanResultOrThrow returns on success", () => {
    expect(parseScanResultOrThrow(minimalValid).totalScore).toBe(42);
  });

  it("parseScanResultOrThrow throws with validation prefix", () => {
    expect(() => parseScanResultOrThrow({})).toThrow(/^validation:/);
  });

  it("scanResultSchema default empty findings when omitted", () => {
    const { findings: _f, ...rest } = minimalValid;
    const parsed = scanResultSchema.parse(rest);
    expect(parsed.findings).toEqual([]);
  });
});

describe("normalizeEngineOutputAbi4 (legacy ingest only)", () => {
  it("synthesizes repositoryHealth from root graph scores when absent", () => {
    const normalized = normalizeEngineOutputAbi4({
      ...minimalValid,
      assessment: minimalAssessment,
      prRisk: { availability: "indeterminate" },
    }) as Record<string, unknown>;
    expect(normalized.repositoryHealth).toEqual({
      totalScore: 42,
      layerScores,
    });
    expect(normalized.totalScore).toBe(42);
  });

  it("does not synthesize prRisk from repositoryHealth", () => {
    const normalized = normalizeEngineOutputAbi4({
      methodologyVersion: "legacy/v1",
      generatedAt: minimalValid.generatedAt,
      assessment: minimalAssessment,
      repositoryHealth: modernRepositoryHealth,
    }) as Record<string, unknown>;
    expect(normalized.prRisk).toBeUndefined();
  });
});

describe("engineOutputScanResultSchema (strict, fresh engine only)", () => {
  it("rejects payload that relaxed parser accepts when methodology is missing", () => {
    const r = safeParseEngineOutputScanResult(minimalValid, "repository");
    expect(r.ok).toBe(false);
  });

  it("accepts modern Assessment-era output without root graph fields", () => {
    const r = safeParseEngineOutputScanResult(
      modernFreshEngineBase(),
      "change_request",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.methodologyVersion).toBe("engine-test-fixture/v1");
      expect(r.result.totalScore).toBeUndefined();
      expect(r.result.layerScores).toBeUndefined();
      expect(r.result.repositoryHealth?.totalScore).toBe(42);
    }
  });

  it("preserves engine-emitted scored prRisk", () => {
    const r = safeParseEngineOutputScanResult(
      modernFreshEngineBase({
        prRisk: { score: 42, layerScores },
      }),
      "change_request",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.prRisk).toEqual({
        score: 42,
        layerScores,
      });
    }
  });

  it("preserves engine-emitted indeterminate prRisk", () => {
    const r = safeParseEngineOutputScanResult(
      modernFreshEngineBase({
        prRisk: {
          availability: "indeterminate",
          qualifier: "limited_evidence",
        },
      }),
      "change_request",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.prRisk).toEqual({
        availability: "indeterminate",
        qualifier: "limited_evidence",
      });
      expect("score" in r.result.prRisk!).toBe(false);
    }
  });

  it("rejects assessment-era output missing prRisk even when repositoryHealth is present", () => {
    const { prRisk: _prRisk, ...withoutPrRisk } = modernFreshEngineBase();
    const r = safeParseEngineOutputScanResult(withoutPrRisk, "change_request");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.includes("prRisk"))).toBe(true);
    }
  });

  it("rejects assessment-era output with null prRisk", () => {
    const r = safeParseEngineOutputScanResult(
      modernFreshEngineBase({ prRisk: null }),
      "change_request",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.includes("prRisk"))).toBe(true);
    }
  });

  it("does not treat repositoryHealth as authoritative PR Risk when prRisk is missing", () => {
    const { prRisk: _prRisk, ...withoutPrRisk } = modernFreshEngineBase({
      repositoryHealth: { totalScore: 72, layerScores },
    });
    const r = safeParseEngineOutputScanResult(withoutPrRisk, "change_request");
    expect(r.ok).toBe(false);
  });

  it("rejects legacy ABI-4 fresh output that still co-emits root graph scores", () => {
    const r = safeParseEngineOutputScanResult(
      {
        ...modernFreshEngineBase(),
        totalScore: 42,
        layerScores,
      },
      "change_request",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.includes("totalScore"))).toBe(true);
      expect(r.issues.some((i) => i.includes("layerScores"))).toBe(true);
    }
  });

  it.each([
    ["signals", [{ id: "s1" }]],
    ["contributions", [{ id: "c1", layer: "security", scoreImpact: 1 }]],
    [
      "explain",
      {
        reasons: [
          {
            id: "r1",
            layer: "security",
            title: "Legacy explain",
            scoreImpact: 1,
          },
        ],
      },
    ],
    ["confidence", "high"],
  ] as const)(
    "rejects modern Assessment-era co-emission of root %s",
    (field, value) => {
      const r = safeParseEngineOutputScanResult(
        modernFreshEngineBase({ [field]: value }),
        "change_request",
      );
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.issues.some((i) => i.includes(field))).toBe(true);
      }
    },
  );

  it("parseEngineOutputScanResultOrThrow throws with validation prefix", () => {
    expect(() =>
      parseEngineOutputScanResultOrThrow(minimalValid, "repository"),
    ).toThrow(/^validation:/);
  });

  it("rejects unparseable generatedAt", () => {
    const r = safeParseEngineOutputScanResult(
      modernFreshEngineBase({ generatedAt: "not-a-date" }),
      "change_request",
    );
    expect(r.ok).toBe(false);
  });

  it("rejects ABI-1 assessment missing focal/scope fields on fresh engine path", () => {
    const legacyAssessment = {
      posture: "safe" as const,
      confidence: "high" as const,
      primaryConcern: null,
      concerns: [],
      factors: ["tooling_maintenance"],
      changeClasses: ["tooling_maintenance" as const],
      presentation: {
        narrativeIntensity: "minimal" as const,
        reachVisibility: "hidden" as const,
        verificationIntensity: "advisory" as const,
        insightEmissionFloor: "none" as const,
        reportMode: "high_signal_pr" as const,
      },
    };
    const r = safeParseEngineOutputScanResult(
      modernFreshEngineBase({ assessment: legacyAssessment }),
      "change_request",
    );
    expect(r.ok).toBe(false);
  });
});

describe("repositoryEngineOutputScanResultSchema", () => {
  const repositoryFreshBase = {
    methodologyVersion: "engine-test-fixture/v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    totalScore: 42,
    layerScores,
    findings: [],
    assessment: minimalAssessment,
    decision: modernDecision,
  };

  it("accepts repository-scoped fresh output with root graph scores", () => {
    const r = safeParseEngineOutputScanResult(
      repositoryFreshBase,
      "repository",
    );
    expect(r.ok).toBe(true);
  });

  it("rejects repository-scoped output that injects prRisk", () => {
    const r = safeParseEngineOutputScanResult(
      {
        ...repositoryFreshBase,
        prRisk: { availability: "indeterminate" as const },
      },
      "repository",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.includes("prRisk"))).toBe(true);
    }
  });

  it("rejects repository-scoped output that injects repositoryHealth", () => {
    const r = safeParseEngineOutputScanResult(
      {
        ...repositoryFreshBase,
        repositoryHealth: modernRepositoryHealth,
      },
      "repository",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.includes("repositoryHealth"))).toBe(true);
    }
  });
});

describe("repositoryEngineOutputScanResultSchema", () => {
  const repositoryFreshBase = {
    methodologyVersion: "engine-test-fixture/v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    totalScore: 42,
    layerScores,
    findings: [],
    assessment: minimalAssessment,
    decision: modernDecision,
  };

  it("accepts repository-scoped fresh output with root graph scores", () => {
    const r = safeParseEngineOutputScanResult(
      repositoryFreshBase,
      "repository",
    );
    expect(r.ok).toBe(true);
  });

  it("rejects repository-scoped output that injects prRisk", () => {
    const r = safeParseEngineOutputScanResult(
      {
        ...repositoryFreshBase,
        prRisk: { availability: "indeterminate" as const },
      },
      "repository",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.includes("prRisk"))).toBe(true);
    }
  });

  it("rejects repository-scoped output that injects repositoryHealth", () => {
    const r = safeParseEngineOutputScanResult(
      {
        ...repositoryFreshBase,
        repositoryHealth: modernRepositoryHealth,
      },
      "repository",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.includes("repositoryHealth"))).toBe(true);
    }
  });
});
