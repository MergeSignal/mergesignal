import { describe, expect, it } from "vitest";
import { deriveScanNarrative } from "./deriveScanNarrative.js";
import { legacyEngineRepoIntelligenceJwt } from "./fixtures/legacyEngineRepoIntelligence.js";
import { applyRepoIntelligenceValidation } from "./repoIntelligenceValidation.js";
import type { ScanResult } from "./types.js";

const baseScan = {
  totalScore: 40,
  layerScores: {
    security: 10,
    maintainability: 10,
    ecosystem: 10,
    upgradeImpact: 10,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
  changedPackages: ["jsonwebtoken"],
  analysisPreparation: {
    codeIntelligenceAvailable: true,
    warnings: [],
  },
} satisfies ScanResult;

describe("applyRepoIntelligenceValidation (production persist model)", () => {
  it("retains raw invalid repoIntelligence and marks status invalid", () => {
    const { result, contractFailed, logPayload } =
      applyRepoIntelligenceValidation({
        ...baseScan,
        repoIntelligence: legacyEngineRepoIntelligenceJwt,
      });

    expect(contractFailed).toBe(true);
    expect(logPayload?.issueCount).toBeGreaterThan(0);
    expect(result.repoIntelligence).toEqual(legacyEngineRepoIntelligenceJwt);
    expect(result.analysisPreparation?.repoIntelligenceValidation?.status).toBe(
      "invalid",
    );
    expect(
      result.analysisPreparation?.warnings.some(
        (w) => w.code === "repo_intelligence_contract_invalid",
      ),
    ).toBe(true);
  });

  it("deriveScanNarrative ignores invalid wire (graph_fallback, untrusted parse status)", () => {
    const { result } = applyRepoIntelligenceValidation({
      ...baseScan,
      repoIntelligence: legacyEngineRepoIntelligenceJwt,
    });

    const facts = deriveScanNarrative(result);
    expect(facts.availability.repoIntelligenceParse).toBe("untrusted");
    expect(facts.availability.tiersPresent.tier1).toBe(false);
    expect(facts.availability.mode).not.toBe("pr_intelligence");
    expect(facts.packageUsage).toHaveLength(0);
  });
});
