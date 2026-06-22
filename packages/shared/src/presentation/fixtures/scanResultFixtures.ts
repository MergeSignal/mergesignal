import type { ScanResult } from "../../types.js";
import { withAbi4SplitScores } from "../../fixtures/engineAbi4Fixtures.js";
import {
  assessmentFastifyRuntime,
  assessmentLimitedContext,
  assessmentTypescriptPatch,
} from "../../fixtures/assessmentFixtures.js";
import {
  fixtureRepoIntelligenceFastify,
  fixtureRepoIntelligenceTypescript,
} from "../../fixtures/repoIntelligenceFixtures.js";
import { analysisPreparationWithValidRepoIntel } from "../../fixtures/repoIntelligenceTestHelpers.js";

const fastifyLayerScores = {
  security: 10,
  maintainability: 20,
  ecosystem: 30,
  upgradeImpact: 15,
} as const;

export const scanResultFastifyRuntime: ScanResult = withAbi4SplitScores(
  {
    totalScore: 63,
    layerScores: fastifyLayerScores,
    findings: [
      {
        id: "finding-fastify-runtime",
        title: "Runtime middleware coupling",
        description: "Fastify middleware ordering may affect auth paths.",
        severity: "medium",
        packageName: "fastify",
        recommendation: "Run auth smoke tests",
      },
    ],
    generatedAt: "2026-01-01T00:00:00.000Z",
    changedPackages: ["fastify"],
    analysisPreparation: analysisPreparationWithValidRepoIntel(),
    repoIntelligence: fixtureRepoIntelligenceFastify,
    assessment: assessmentFastifyRuntime,
    decision: {
      recommendation: "needs_review",
      confidence: "medium",
      reasoning: [
        "Changed package has confirmed usage on runtime application paths in this repository.",
        "HTTP framework infrastructure",
      ],
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
  },
  {
    prRiskScore: 55,
    repositoryHealthScore: 63,
    layerScores: fastifyLayerScores,
  },
);

const typescriptLayerScores = {
  security: 5,
  maintainability: 8,
  ecosystem: 10,
  upgradeImpact: 5,
} as const;

export const scanResultTypescriptPatch: ScanResult = withAbi4SplitScores(
  {
    totalScore: 63,
    layerScores: typescriptLayerScores,
    findings: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    changedPackages: ["typescript"],
    analysisPreparation: analysisPreparationWithValidRepoIntel(),
    repoIntelligence: fixtureRepoIntelligenceTypescript,
    assessment: assessmentTypescriptPatch,
    decision: {
      recommendation: "safe",
      confidence: "high",
      reasoning: [
        "No dedicated dependency review required beyond normal engineering process.",
      ],
    },
    graphInsights: {
      maxDepth: 4,
      nodes: 120,
      edges: 340,
      hotspots: [],
    },
  },
  {
    prRiskScore: 30,
    repositoryHealthScore: 63,
    layerScores: typescriptLayerScores,
  },
);

export const scanResultLimitedContext: ScanResult = {
  totalScore: 40,
  layerScores: {
    security: 10,
    maintainability: 10,
    ecosystem: 10,
    upgradeImpact: 10,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
  changedPackages: ["lodash"],
  analysisPreparation: {
    codeIntelligenceAvailable: false,
    warnings: [
      {
        code: "base_lockfile_missing",
        message: "Base lockfile not available for diff",
      },
    ],
  },
  repoIntelligence: { invalid: true },
  assessment: assessmentLimitedContext,
  graphInsights: {
    maxDepth: 5,
    nodes: 200,
    edges: 500,
    hotspots: [
      { kind: "hotspot", packageName: "lodash", direct: true, depth: 2 },
    ],
  },
  decision: {
    recommendation: "needs_review",
    confidence: "low",
    reasoning: [
      "Collection evidence is partial; confidence is reduced but review posture is preserved when runtime signals exist.",
    ],
  },
};
