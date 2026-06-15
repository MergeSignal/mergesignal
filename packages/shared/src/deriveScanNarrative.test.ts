import { describe, expect, it } from "vitest";
import { deriveScanNarrative } from "./deriveScanNarrative.js";
import { legacyEngineRepoIntelligenceJwt } from "./fixtures/legacyEngineRepoIntelligence.js";
import {
  fixtureRepoIntelligenceFastify,
  fixtureRepoIntelligenceMultiPackage,
  fixtureRepoIntelligenceTypescript,
} from "./fixtures/repoIntelligenceFixtures.js";
import {
  analysisPreparationWithInvalidRepoIntel,
  analysisPreparationWithValidRepoIntel,
} from "./fixtures/repoIntelligenceTestHelpers.js";
import type { ScanResult } from "./types.js";
import { assessmentFastifyRuntime } from "./fixtures/assessmentFixtures.js";

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

  it("ignores repoIntelligence when validation status is not valid", () => {
    const result = {
      ...baseResult,
      changedPackages: ["fastify"],
      analysisPreparation: {
        codeIntelligenceAvailable: true,
        warnings: [],
      },
      repoIntelligence: fixtureRepoIntelligenceFastify,
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.availability.repoIntelligenceParse).toBe("absent");
    expect(facts.availability.tiersPresent.tier1).toBe(false);
  });

  it("treats worker-invalid repoIntelligence as untrusted (raw retained, not consumed)", () => {
    const result = {
      ...baseResult,
      changedPackages: ["jsonwebtoken"],
      analysisPreparation: analysisPreparationWithInvalidRepoIntel(),
      repoIntelligence: legacyEngineRepoIntelligenceJwt,
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.availability.repoIntelligenceParse).toBe("untrusted");
    expect(facts.availability.tiersPresent.tier1).toBe(false);
    expect(facts.packageUsage).toHaveLength(0);
  });

  it("populates tier1 from repoIntelligence when corpus available", () => {
    const result = {
      ...baseResult,
      changedPackages: ["fastify"],
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
      repoIntelligence: fixtureRepoIntelligenceFastify,
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.availability.mode).toBe("pr_intelligence");
    expect(facts.availability.repoIntelligenceParse).toBe("ok");
    expect(facts.availability.codeIntelligenceAvailable).toBe(true);
    expect(facts.changedPackages.primary).toBe("fastify");
    expect(facts.runtimeSurface?.kind).toBe("runtime");
    expect(facts.reachability?.kind).toBe("on_runtime_paths");
    expect(facts.blastRadius?.level).toBe("moderate");
    expect(facts.affectedAreas.map((a) => a.id)).toContain("api");
    expect(facts.hotspots[0]?.source).toBe("code");
  });

  it("changedPackages.primary follows reviewFocalPoint anchor, not changedPackages order", () => {
    const result = {
      ...baseResult,
      changedPackages: ["typescript", "fastify"],
      assessment: assessmentFastifyRuntime,
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
      repoIntelligence: fixtureRepoIntelligenceFastify,
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.changedPackages.primary).toBe("fastify");
    expect(result.changedPackages?.[0]).toBe("typescript");
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

  it("populates tooling semantics without runtime surface chips for typescript", () => {
    const result = {
      ...baseResult,
      changedPackages: ["typescript"],
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
      repoIntelligence: fixtureRepoIntelligenceTypescript,
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.availability.mode).toBe("pr_intelligence");
    expect(facts.runtimeSurface).toBeNull();
    expect(facts.reachability).toBeNull();
    expect(facts.packageSemantics?.runtimeImpact).toBe("none");
    expect(facts.packageSemantics?.expectedImpact).toBe("typecheck");
    expect(facts.packageSemantics?.suppressRuntimeNarrative).toBe(true);
    expect(facts.packageSemantics?.dependencyClass).toBe("tooling");
    expect(facts.packageSemantics?.packageRole).toBe("typechecker");
    expect(facts.changedPackageSemantics).toHaveLength(1);
    expect(facts.changedPackageSemantics[0]?.packageName).toBe("typescript");
    expect(facts.blastRadius?.level).toBe("narrow");
  });

  it("extracts packageUsage for all changed packages with blast factors and frameworks", () => {
    const result = {
      ...baseResult,
      changedPackages: ["lodash", "axios"],
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
      repoIntelligence: fixtureRepoIntelligenceMultiPackage,
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.packageUsage).toHaveLength(2);
    expect(facts.packageUsage.map((u) => u.packageName)).toEqual([
      "lodash",
      "axios",
    ]);
    expect(facts.packageUsage[0]?.paths).toContain("apps/billing/export.ts");
    expect(facts.blastRadius?.factors).toEqual([
      "multiple_runtime_consumers",
      "shared_middleware",
    ]);
    expect(facts.frameworks).toEqual(["express", "react"]);
    expect(facts.reachability?.evidence.frameworks).toEqual([
      "express",
      "react",
    ]);
  });

  it("merges graph hotspots without duplicating code hotspots", () => {
    const result = {
      ...baseResult,
      changedPackages: ["fastify"],
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
      repoIntelligence: fixtureRepoIntelligenceFastify,
      graphInsights: {
        maxDepth: 3,
        nodes: 10,
        edges: 12,
        hotspots: [
          {
            kind: "hotspot",
            packageName: "fastify",
            direct: true,
            depth: 2,
          },
          {
            kind: "hotspot",
            packageName: "transitive-only-pkg",
            direct: false,
            depth: 4,
          },
        ],
      },
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.hotspots.map((h) => h.packageName)).toContain("fastify");
    expect(facts.hotspots.map((h) => h.packageName)).toContain(
      "transitive-only-pkg",
    );
    expect(
      facts.hotspots.filter((h) => h.packageName === "fastify"),
    ).toHaveLength(1);
  });

  it("does not tier1 when repoIntelligence block is omitted", () => {
    const result = {
      ...baseResult,
      changedPackages: ["react"],
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.availability.repoIntelligenceParse).toBe("absent");
    expect(facts.availability.tiersPresent.tier1).toBe(false);
  });

  it("projects preparation warnings and corpus gate reason", () => {
    const result = {
      ...baseResult,
      changedPackages: ["lodash"],
      analysisPreparation: {
        codeIntelligenceAvailable: false,
        warnings: [
          {
            code: "base_lockfile_missing",
            message: "Base lockfile not available",
          },
        ],
      },
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.availability.preparationWarnings).toHaveLength(1);
    expect(facts.availability.preparationWarnings[0]?.code).toBe(
      "base_lockfile_missing",
    );
    expect(facts.availability.corpusGateReason).toBe("no_code_intelligence");
    expect(facts.confidence.limitedContext).toBe(true);
  });

  it("links affected areas to packages, findings, paths, and verification", () => {
    const result = {
      ...baseResult,
      changedPackages: ["fastify"],
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
      repoIntelligence: fixtureRepoIntelligenceFastify,
      findings: [
        {
          id: "f1",
          title: "Auth middleware",
          description: "d",
          severity: "high",
          packageName: "fastify",
        },
      ],
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    const apiArea = facts.affectedAreas.find((a) => a.id === "api");
    expect(apiArea).toBeDefined();
    expect(apiArea?.packages).toContain("fastify");
    expect(apiArea?.findingIds).toContain("f1");
    expect(apiArea?.paths.length).toBeGreaterThan(0);
    expect(apiArea?.evidenceStrength).toBe("high");
    expect(apiArea?.hotspotPackages).toContain("fastify");
    expect(apiArea?.verificationFocus).toContain("routes");
  });

  it("derives riskSignals with exposure layers", () => {
    const facts = deriveScanNarrative(baseResult);
    expect(facts.riskSignals?.riskIndex).toBe(10);
    expect(facts.riskSignals?.exposure).toBe("minimal");
    expect(facts.riskSignals?.layers).toHaveLength(4);
    expect(facts.riskIndex).toBe(10);
  });

  it("projects assessment confidence verbatim", () => {
    const result = {
      ...baseResult,
      assessment: assessmentFastifyRuntime,
    } satisfies ScanResult;

    const facts = deriveScanNarrative(result);
    expect(facts.confidence.assessment).toBe("medium");
  });
});
