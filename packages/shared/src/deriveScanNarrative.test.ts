import { describe, expect, it } from "vitest";
import { deriveScanNarrative } from "./deriveScanNarrative.js";
import {
  fixtureRepoIntelligenceEmpty,
  fixtureRepoIntelligenceFastify,
  fixtureRepoIntelligenceTypescript,
} from "./fixtures/repoIntelligenceFixtures.js";
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

describe("deriveScanNarrative", () => {
  it("returns denormalized empty facts for null result", () => {
    const facts = deriveScanNarrative(null);
    expect(facts.availability.mode).toBe("denormalized");
    expect(facts.changedPackages.all).toEqual([]);
  });

  it("populates tier1 from repoIntelligence when corpus available", () => {
    const result = {
      ...baseResult,
      changedPackages: ["fastify"],
      analysisPreparation: { codeIntelligenceAvailable: true, warnings: [] },
      repoIntelligence: fixtureRepoIntelligenceFastify,
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.availability.mode).toBe("pr_intelligence");
    expect(facts.availability.codeIntelligenceAvailable).toBe(true);
    expect(facts.changedPackages.primary).toBe("fastify");
    expect(facts.runtimeSurface?.kind).toBe("runtime");
    expect(facts.reachability?.kind).toBe("on_runtime_paths");
    expect(facts.blastRadius?.level).toBe("moderate");
    expect(facts.affectedAreas.map((a) => a.id)).toContain("api");
    expect(facts.hotspots[0]?.source).toBe("code");
  });

  it("prefers changed-scope insights for reviewer guidance ordering", () => {
    const result = {
      ...baseResult,
      changedPackages: ["lodash"],
      insights: [
        {
          type: "dependency_risk",
          priority: "medium",
          confidence: "likely",
          scope: "all",
          message: "Repository-wide duplicate paths",
          context: "c",
          remediation: "r",
        },
        {
          type: "usage_risk",
          priority: "high",
          confidence: "confirmed",
          scope: "changed",
          message: "lodash used in billing export",
          context: "c2",
          remediation: "r2",
        },
      ],
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.reviewerGuidance[0]?.scope).toBe("changed");
    expect(facts.reviewerGuidance[0]?.message).toContain("billing");
  });

  it("uses graph_fallback with structured repository context", () => {
    const result = {
      ...baseResult,
      explain: {
        reasons: [
          {
            id: "1",
            layer: "ecosystem",
            title: "graph.transitive volume",
            scoreImpact: 18,
          },
        ],
      },
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.availability.mode).toBe("graph_fallback");
    expect(facts.repositoryContext.length).toBeGreaterThan(0);
    expect(facts.repositoryContext[0]?.family).toBe("transitive_volume");
  });

  it("populates build-only runtime surface from repoIntelligence", () => {
    const result = {
      ...baseResult,
      changedPackages: ["typescript"],
      analysisPreparation: { codeIntelligenceAvailable: true, warnings: [] },
      repoIntelligence: fixtureRepoIntelligenceTypescript,
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.availability.mode).toBe("pr_intelligence");
    expect(facts.runtimeSurface?.kind).toBe("build");
    expect(facts.reachability?.kind).toBe("build_only");
    expect(facts.blastRadius?.level).toBe("narrow");
  });

  it("treats empty packages-only repoIntelligence as absent", () => {
    const result = {
      ...baseResult,
      changedPackages: ["react"],
      analysisPreparation: { codeIntelligenceAvailable: true, warnings: [] },
      repoIntelligence: fixtureRepoIntelligenceEmpty,
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.availability.tiersPresent.tier1).toBe(false);
  });
});
