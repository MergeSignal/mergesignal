import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  assertTrustedActionsSummaryAllowed,
  assertTrustedScanResult,
  auditTrustedActionsOutput,
  isStubMethodologyVersion,
  trustedActionsSummaryDenylistPhrases,
  validateTrustedEngineScanResult,
} from "./trustedScanGuards.js";
import { assessmentStub } from "./fixtures/assessmentFixtures.js";
import type { ScanResult } from "./types.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";

/** Repository-scoped trusted `ms scan` output shape (GitHub Action audit path). */
const trustedActionRepositoryScan: ScanResult = {
  totalScore: 12,
  layerScores: {
    security: 10,
    maintainability: 10,
    ecosystem: 15,
    upgradeImpact: 13,
  },
  findings: [],
  recommendations: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
  methodologyVersion: "mergesignal-engine/v2.20.0",
};

const changeRequestTrustedScan: ScanResult = {
  findings: [],
  recommendations: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
  methodologyVersion: "engine-stub/v2",
  assessment: assessmentStub,
  prRisk: { availability: "indeterminate" },
  repositoryHealth: {
    totalScore: 10,
    layerScores: {
      security: 10,
      maintainability: 10,
      ecosystem: 10,
      upgradeImpact: 10,
    },
  },
  decision: {
    recommendation: "needs_review",
    confidence: "low",
    reasoning: ["Stub engine cannot perform real analysis"],
  },
};

describe("trustedScanGuards", () => {
  it("detects stub methodology", () => {
    expect(isStubMethodologyVersion("engine-stub/v2")).toBe(true);
    expect(isStubMethodologyVersion("Engine-Stub/v1")).toBe(true);
    expect(isStubMethodologyVersion("acme-engine/v1")).toBe(false);
    expect(isStubMethodologyVersion(undefined)).toBe(false);
  });

  it("denylist includes demo copy", () => {
    const d = trustedActionsSummaryDenylistPhrases();
    expect(d).toContain(scanSurfaceCopy.actions.demoSummaryTitle);
    expect(d).toContain(scanSurfaceCopy.actions.demoSummaryBanner);
  });

  it("assertTrustedActionsSummaryAllowed throws for trusted + stub", () => {
    expect(() =>
      assertTrustedActionsSummaryAllowed("trusted", "engine-stub/v2"),
    ).toThrow(/verification requirements/);
  });

  it("assertTrustedActionsSummaryAllowed allows trusted + real methodology", () => {
    expect(() =>
      assertTrustedActionsSummaryAllowed("trusted", "acme-prod/v3"),
    ).not.toThrow();
  });

  it("assertTrustedActionsSummaryAllowed ignores non-trusted profile", () => {
    expect(() =>
      assertTrustedActionsSummaryAllowed("development", "engine-stub/v2"),
    ).not.toThrow();
  });

  describe("assertTrustedScanResult", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.MERGESIGNAL_TRUSTED_METHODOLOGY_PREFIX;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("rejects stub methodology", () => {
      expect(() => assertTrustedScanResult(changeRequestTrustedScan)).toThrow(
        /verification requirements/,
      );
    });

    it("accepts non-stub methodology", () => {
      expect(() =>
        assertTrustedScanResult({
          ...changeRequestTrustedScan,
          methodologyVersion: "engine-test-fixture/v1",
        }),
      ).not.toThrow();
    });

    it("enforces methodology prefix when env set", () => {
      process.env.MERGESIGNAL_TRUSTED_METHODOLOGY_PREFIX =
        "engine-test-fixture/";
      expect(() =>
        assertTrustedScanResult({
          ...changeRequestTrustedScan,
          methodologyVersion: "engine-test-fixture/v1",
        }),
      ).not.toThrow();
      expect(() =>
        assertTrustedScanResult({
          ...changeRequestTrustedScan,
          methodologyVersion: "other/v1",
        }),
      ).toThrow(/methodology output did not match/);
    });
  });

  describe("validateTrustedEngineScanResult", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.MERGESIGNAL_TRUSTED_METHODOLOGY_PREFIX;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("rejects structurally valid relaxed payload without methodologyVersion", () => {
      expect(() =>
        validateTrustedEngineScanResult(
          {
            totalScore: 10,
            layerScores: {
              security: 10,
              maintainability: 10,
              ecosystem: 10,
              upgradeImpact: 10,
            },
            findings: [],
            generatedAt: "2026-01-01T00:00:00.000Z",
          },
          "repository",
        ),
      ).toThrow(/^validation:/);
    });

    it("returns result when strict schema and trusted policy pass", () => {
      const r = validateTrustedEngineScanResult(
        {
          ...changeRequestTrustedScan,
          methodologyVersion: "acme-prod/v2",
        },
        "change_request",
      );
      expect(r.methodologyVersion).toBe("acme-prod/v2");
    });

    it("rejects repository output that includes change-request authorities", () => {
      expect(() =>
        validateTrustedEngineScanResult(
          {
            totalScore: 10,
            layerScores: {
              security: 10,
              maintainability: 10,
              ecosystem: 10,
              upgradeImpact: 10,
            },
            findings: [],
            generatedAt: "2026-01-01T00:00:00.000Z",
            methodologyVersion: "acme-prod/v2",
            assessment: assessmentStub,
            repositoryHealth: {
              totalScore: 10,
              layerScores: {
                security: 10,
                maintainability: 10,
                ecosystem: 10,
                upgradeImpact: 10,
              },
            },
            decision: {
              recommendation: "needs_review",
              confidence: "low",
              reasoning: ["Stub engine cannot perform real analysis"],
            },
          },
          "repository",
        ),
      ).toThrow(/^validation:/);
    });
  });

  describe("auditTrustedActionsOutput", () => {
    it("fails when summary contains demo title", () => {
      const r = auditTrustedActionsOutput({
        summaryText: `Hello ${scanSurfaceCopy.actions.demoSummaryTitle} world`,
        scanResult: trustedActionRepositoryScan,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
    });

    it("passes for clean summary and repository-scoped trusted ms scan output", () => {
      const r = auditTrustedActionsOutput({
        summaryText: "# MergeSignal\n\nLow risk posture.",
        scanResult: trustedActionRepositoryScan,
      });
      expect(r).toEqual({ ok: true });
    });

    it("fails when scan JSON omits methodology (strict engine contract)", () => {
      const r = auditTrustedActionsOutput({
        summaryText: "# MergeSignal\n\nLow risk posture.",
        scanResult: {
          totalScore: 10,
          layerScores: {
            security: 10,
            maintainability: 10,
            ecosystem: 10,
            upgradeImpact: 10,
          },
          findings: [],
          generatedAt: "2026-01-01T00:00:00.000Z",
        },
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors.some((e) => e.startsWith("validation:"))).toBe(true);
      }
    });

    it("fails when trusted action output is change-request scoped", () => {
      const r = auditTrustedActionsOutput({
        summaryText: "# MergeSignal\n\nLow risk posture.",
        scanResult: {
          ...changeRequestTrustedScan,
          methodologyVersion: "mergesignal-engine/v2.20.0",
        },
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors.some((e) => e.startsWith("validation:"))).toBe(true);
      }
    });
  });
});
