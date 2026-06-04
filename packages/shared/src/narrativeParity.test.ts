import { describe, expect, it } from "vitest";
import { buildScanPresentationBundle } from "./presentation/orchestration/buildScanPresentationBundle.js";
import { presentScanCard } from "./presentation/presenters/presentScanCard.js";
import { presentScanDetails } from "./presentation/presenters/presentScanDetails.js";
import { presentGitHubPrComment } from "./presentation/presenters/presentGitHubPrComment.js";
import { renderGitHubCheckRunMarkdown } from "./presentation/render/renderGitHubCheckRunMarkdown.js";
import { presentGitHubCheckRun } from "./presentation/presenters/presentGitHubCheckRun.js";
import { fixtureRepoIntelligenceFastify } from "./fixtures/repoIntelligenceFixtures.js";
import { analysisPreparationWithValidRepoIntel } from "./fixtures/repoIntelligenceTestHelpers.js";
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
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
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

    const bundle = buildScanPresentationBundle({
      result,
      pipelineStatus: "done",
    })!;

    const card = presentScanCard(bundle);
    const detail = presentScanDetails(bundle, {
      scanId: SCAN_ID,
    });
    const checkRun = renderGitHubCheckRunMarkdown(
      presentGitHubCheckRun(bundle, {
        scanId: SCAN_ID,
        webAppOrigin: ORIGIN,
        baseline: false,
      }),
    );
    const prComment = presentGitHubPrComment(bundle);

    expect(card.primaryPackage).toBe("fastify");
    expect(detail.narrative.primaryPackage).toBe("fastify");
    expect(card.evidence.some((e) => e.label === "Reachability")).toBe(true);

    const asciiOnly = /^[\x00-\x7F]*$/;
    expect(asciiOnly.test(checkRun)).toBe(true);
    expect(checkRun.toLowerCase()).toContain("fastify");
    expect(prComment.title.toLowerCase()).toContain("review");
  });
});
