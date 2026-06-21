import { describe, it, expect } from "vitest";
import {
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
import { withAbi4EngineScores } from "./fixtures/engineAbi4Fixtures.js";

const minimalValid = {
  totalScore: 42,
  layerScores: {
    security: 10,
    maintainability: 20,
    ecosystem: 30,
    upgradeImpact: 40,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("scanResultSchema", () => {
  it("accepts a minimal valid payload", () => {
    const r = safeParseScanResult(minimalValid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.totalScore).toBe(42);
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

  it("rejects missing layerScores", () => {
    const r = safeParseScanResult({
      totalScore: 1,
      findings: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(r.ok).toBe(false);
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
  presentation: {
    narrativeIntensity: "minimal" as const,
    reachVisibility: "hidden" as const,
    verificationIntensity: "advisory" as const,
    insightEmissionFloor: "none" as const,
    reportMode: "high_signal_pr" as const,
  },
};

describe("engineOutputScanResultSchema (strict, fresh engine only)", () => {
  const withMethodology = withAbi4EngineScores({
    ...minimalValid,
    methodologyVersion: "engine-test-fixture/v1",
    assessment: minimalAssessment,
  });

  it("rejects payload that relaxed parser accepts when methodology is missing", () => {
    const r = safeParseEngineOutputScanResult(minimalValid);
    expect(r.ok).toBe(false);
  });

  it("accepts when methodology and parseable generatedAt are present", () => {
    const r = safeParseEngineOutputScanResult(withMethodology);
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.result.methodologyVersion).toBe("engine-test-fixture/v1");
  });

  it("synthesizes prRisk/repositoryHealth from totalScore for legacy engines", () => {
    const r = safeParseEngineOutputScanResult({
      ...minimalValid,
      methodologyVersion: "acme-prod/v1",
      assessment: minimalAssessment,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.prRisk?.score).toBe(42);
      expect(r.result.repositoryHealth?.totalScore).toBe(42);
    }
  });

  it("parseEngineOutputScanResultOrThrow throws with validation prefix", () => {
    expect(() => parseEngineOutputScanResultOrThrow(minimalValid)).toThrow(
      /^validation:/,
    );
  });

  it("rejects unparseable generatedAt", () => {
    const r = safeParseEngineOutputScanResult({
      ...withMethodology,
      generatedAt: "not-a-date",
    });
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
    const r = safeParseEngineOutputScanResult({
      ...withMethodology,
      assessment: legacyAssessment,
    });
    expect(r.ok).toBe(false);
  });
});
