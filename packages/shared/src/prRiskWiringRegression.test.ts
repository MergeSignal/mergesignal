import { describe, expect, it } from "vitest";
import { deriveScanNarrative } from "./deriveScanNarrative.js";
import { resolveRepositoryHealthScore } from "./prRiskWire.js";
import { buildScanPresentationBundle } from "./presentation/orchestration/buildScanPresentationBundle.js";
import { presentDashboardCard } from "./presentation/presenters/presentDashboardCard.js";
import { presentScanDetails } from "./presentation/presenters/presentScanDetails.js";
import { presentCliScanSummary } from "./presentation/presenters/presentCliScanSummary.js";
import { presentGitHubCheckRun } from "./presentation/presenters/presentGitHubCheckRun.js";
import { presentGitHubPrComment } from "./presentation/presenters/presentGitHubPrComment.js";
import {
  scanResultFastifyRuntime,
  scanResultTypescriptPatch,
} from "./presentation/fixtures/scanResultFixtures.js";
import { scanResultPrettier } from "./presentation/fixtures/presentationPersonaFixtures.js";
import type { ScanResult } from "./types.js";

const SCAN_ID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://app.example.com";

const validationPrShapes: Array<{
  id: string;
  result: ScanResult;
  expectedPrRisk: number;
  expectedRepositoryHealth: number;
}> = [
  {
    id: "PR #27 fastify",
    result: scanResultFastifyRuntime,
    expectedPrRisk: 55,
    expectedRepositoryHealth: 63,
  },
  {
    id: "PR #28 typescript",
    result: scanResultTypescriptPatch,
    expectedPrRisk: 30,
    expectedRepositoryHealth: 63,
  },
  {
    id: "PR #29 prettier",
    result: scanResultPrettier,
    expectedPrRisk: 30,
    expectedRepositoryHealth: 61,
  },
];

function surfacesFor(result: ScanResult) {
  const bundle = buildScanPresentationBundle({
    result,
    pipelineStatus: "done",
  })!;
  return {
    bundle,
    card: presentDashboardCard(bundle),
    details: presentScanDetails(bundle, { scanId: SCAN_ID }),
    cli: presentCliScanSummary(bundle, { repoLabel: "mergesignal/app" }),
    check: presentGitHubCheckRun(bundle, {
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
    }),
    comment: presentGitHubPrComment(bundle),
  };
}

describe("PR Risk wiring regression (Investigation 1)", () => {
  it.each(validationPrShapes)(
    "$id: riskIndex follows prRisk.score, not repository health",
    ({ result, expectedPrRisk, expectedRepositoryHealth }) => {
      expect(result.prRisk?.score).toBe(expectedPrRisk);
      expect(result.repositoryHealth?.totalScore).toBe(
        expectedRepositoryHealth,
      );
      expect(result.totalScore).toBe(expectedRepositoryHealth);
      expect(resolveRepositoryHealthScore(result)).toBe(
        expectedRepositoryHealth,
      );

      const facts = deriveScanNarrative(result);
      expect(facts.riskSignals?.riskIndex).toBe(expectedPrRisk);
      expect(facts.riskIndex).toBe(expectedPrRisk);

      const { card, details, cli, check, comment } = surfacesFor(result);

      expect(card.sortKey.riskIndex).toBe(expectedPrRisk);
      expect(details.hero.prRiskScore).toBe(expectedPrRisk);
      expect(details.signalSummary?.prRiskScore).toBe(expectedPrRisk);
      expect(cli.metrics?.prRiskScore).toBe(expectedPrRisk);
      expect(cli.metrics?.riskIndex).toBe(expectedPrRisk);

      const prRiskSection = check.sections.find((s) => s.title === "PR Risk");
      expect(prRiskSection?.bullets[0]).toMatch(
        new RegExp(`^${expectedPrRisk} \\(`),
      );
      expect(comment.introLines.some((l) => l.startsWith("PR Risk:"))).toBe(
        true,
      );
      expect(
        comment.introLines.find((l) => l.startsWith("PR Risk:")),
      ).toContain(String(expectedPrRisk));
    },
  );

  it("same repository health with different PR evidence yields different riskIndex", () => {
    const fastify = surfacesFor(scanResultFastifyRuntime);
    const typescript = surfacesFor(scanResultTypescriptPatch);

    expect(resolveRepositoryHealthScore(scanResultFastifyRuntime)).toBe(
      resolveRepositoryHealthScore(scanResultTypescriptPatch),
    );
    expect(fastify.card.sortKey.riskIndex).not.toBe(
      typescript.card.sortKey.riskIndex,
    );
    expect(fastify.card.sortKey.riskIndex).toBe(55);
    expect(typescript.card.sortKey.riskIndex).toBe(30);
  });

  it("historical fallback: missing prRisk uses totalScore for riskIndex", () => {
    const historical: ScanResult = {
      totalScore: 48,
      layerScores: {
        security: 10,
        maintainability: 12,
        ecosystem: 14,
        upgradeImpact: 12,
      },
      findings: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
      assessment: scanResultTypescriptPatch.assessment,
      decision: scanResultTypescriptPatch.decision,
    };

    const facts = deriveScanNarrative(historical);
    expect(facts.riskSignals?.riskIndex).toBe(48);
    expect(facts.riskIndex).toBe(48);

    const bundle = buildScanPresentationBundle({
      result: historical,
      pipelineStatus: "done",
    })!;
    expect(presentDashboardCard(bundle).sortKey.riskIndex).toBe(48);
  });
});
