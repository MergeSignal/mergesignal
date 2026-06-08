import { describe, expect, it } from "vitest";
import { deriveScanCardSummary } from "./scanCardSummary.js";
import { deriveScanNarrative } from "./deriveScanNarrative.js";
import {
  fixtureRepoIntelligenceFastify,
  fixtureRepoIntelligenceMultiPackage,
} from "./fixtures/repoIntelligenceFixtures.js";
import { validateRepoIntelligenceWire } from "./repoIntelligenceSchema.js";
import type { ScanResult } from "./types.js";

const baseScan = {
  totalScore: 55,
  layerScores: {
    security: 10,
    maintainability: 20,
    ecosystem: 30,
    upgradeImpact: 15,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
  analysisPreparation: {
    codeIntelligenceAvailable: true,
    warnings: [],
    repoIntelligenceValidation: {
      status: "valid" as const,
      abi: "1",
      validatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
} satisfies Partial<ScanResult>;

describe("engine wire regression (canonical fixtures)", () => {
  it("fastify fixture: parse → tier1 pr_intelligence → card usage lines", () => {
    validateRepoIntelligenceWire(fixtureRepoIntelligenceFastify);
    const result = {
      ...baseScan,
      changedPackages: ["fastify"],
      repoIntelligence: fixtureRepoIntelligenceFastify,
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.availability.tiersPresent.tier1).toBe(true);
    expect(facts.availability.mode).toBe("pr_intelligence");
    expect(facts.availability.repoIntelligenceParse).toBe("ok");
    expect(facts.packageUsage[0]?.packageName).toBe("fastify");

    const card = deriveScanCardSummary(result, "done");
    expect(card.insights.length).toBeGreaterThan(0);
    expect(card.verification.length).toBeGreaterThan(0);
  });

  it("multi-package fixture: both packages in packageUsage", () => {
    validateRepoIntelligenceWire(fixtureRepoIntelligenceMultiPackage);
    const result = {
      ...baseScan,
      changedPackages: ["lodash", "axios"],
      repoIntelligence: fixtureRepoIntelligenceMultiPackage,
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.availability.mode).toBe("pr_intelligence");
    expect(facts.packageUsage.map((u) => u.packageName)).toEqual([
      "lodash",
      "axios",
    ]);
  });
});
