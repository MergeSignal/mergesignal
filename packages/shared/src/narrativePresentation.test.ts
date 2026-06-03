import { describe, expect, it } from "vitest";
import { deriveScanNarrative } from "./deriveScanNarrative.js";
import { fixtureRepoIntelligenceFastify } from "./fixtures/repoIntelligenceFixtures.js";
import {
  composeVerificationPrompt,
  formatChangedPackagesShort,
  formatUsageSummaryLine,
  summarizePackageUsage,
} from "./narrativePresentation.js";
import type { ScanResult } from "./types.js";

const baseResult = {
  totalScore: 10,
  layerScores: {
    security: 1,
    maintainability: 2,
    ecosystem: 3,
    upgradeImpact: 4,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
} satisfies ScanResult;

describe("narrativePresentation", () => {
  it("formats changed packages with second name when only one other", () => {
    const facts = deriveScanNarrative({
      ...baseResult,
      changedPackages: ["lodash", "axios"],
    });
    expect(formatChangedPackagesShort(facts, 2)).toBe("lodash, axios");
  });

  it("summarizes package usage paths from facts", () => {
    const facts = deriveScanNarrative({
      ...baseResult,
      changedPackages: ["fastify"],
      analysisPreparation: { codeIntelligenceAvailable: true, warnings: [] },
      repoIntelligence: fixtureRepoIntelligenceFastify,
    });
    const usage = summarizePackageUsage(facts);
    expect(usage?.pathCount).toBeGreaterThan(0);
    expect(formatUsageSummaryLine(facts)).toMatch(/Used in/);
  });

  it("composes verification from remediation when present", () => {
    const facts = deriveScanNarrative({
      ...baseResult,
      changedPackages: ["pkg"],
      insights: [
        {
          type: "usage_risk",
          priority: "high",
          confidence: "confirmed",
          scope: "changed",
          message: "Risk in billing",
          context: "billing",
          remediation: "Run export job smoke test",
        },
      ],
    });
    expect(composeVerificationPrompt(facts)).toBe("Run export job smoke test");
  });
});
