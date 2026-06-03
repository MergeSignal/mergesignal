import { describe, expect, it } from "vitest";
import { deriveScanNarrative } from "./deriveScanNarrative.js";
import { buildPrCheckRunSummaryMarkdown } from "./prCheckRunPresentation.js";
import { deriveScanCardSummary } from "./scanCardSummary.js";
import { deriveScanDetailViewModel } from "./scanDetailViewModel.js";
import { presentGitHubPrComment } from "./presentGitHubPrComment.js";
import { fixtureRepoIntelligenceFastify } from "./fixtures/repoIntelligenceFixtures.js";
import type { ScanResult } from "./types.js";

const ORIGIN = "https://app.example.com";
const SCAN_ID = "22222222-2222-4222-8222-222222222222";

describe("narrative parity across consumers", () => {
  it("card, detail, GitHub share primary package and reachability story", () => {
    const result = {
      totalScore: 55,
      layerScores: {
        security: 10,
        maintainability: 20,
        ecosystem: 30,
        upgradeImpact: 15,
      },
      findings: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
      changedPackages: ["fastify"],
      analysisPreparation: { codeIntelligenceAvailable: true, warnings: [] },
      repoIntelligence: fixtureRepoIntelligenceFastify,
      decision: {
        recommendation: "needs_review",
        confidence: "medium",
        reasoning: [],
      },
      insights: [
        {
          type: "usage_risk",
          priority: "high",
          confidence: "confirmed",
          scope: "changed",
          message: "Review fastify middleware ordering",
          context: "apps/api/src/middleware/auth.ts",
          remediation: "Run auth smoke tests",
        },
      ],
    } satisfies ScanResult;

    const card = deriveScanCardSummary(result, "done");
    const detail = deriveScanDetailViewModel(result, {
      scanId: SCAN_ID,
      status: "done",
    });
    const checkRun = buildPrCheckRunSummaryMarkdown({
      result,
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
      baseline: false,
    });
    const prComment = presentGitHubPrComment(
      deriveScanNarrative(result),
      result,
    );

    expect(card.changedPackagesDisplay).toContain("fastify");
    expect(detail?.narrativeContext.changedPackagesDisplay).toContain(
      "fastify",
    );
    expect(card.reachabilityLabel).toBe("On runtime paths");
    expect(detail?.narrativeContext.reachabilityLabel).toBe("On runtime paths");

    const asciiOnly = /^[\x00-\x7F]*$/;
    expect(asciiOnly.test(checkRun)).toBe(true);
    expect(asciiOnly.test(prComment)).toBe(true);
    expect(checkRun.toLowerCase()).toContain("fastify");
    expect(prComment.toLowerCase()).toContain("fastify");
  });
});
