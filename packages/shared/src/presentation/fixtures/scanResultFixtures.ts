import type { ScanResult } from "../../types.js";
import {
  fixtureRepoIntelligenceFastify,
  fixtureRepoIntelligenceTypescript,
} from "../../fixtures/repoIntelligenceFixtures.js";
import { analysisPreparationWithValidRepoIntel } from "../../fixtures/repoIntelligenceTestHelpers.js";

export const scanResultFastifyRuntime: ScanResult = {
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
};

export const scanResultTypescriptPatch: ScanResult = {
  totalScore: 18,
  layerScores: {
    security: 5,
    maintainability: 8,
    ecosystem: 10,
    upgradeImpact: 5,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
  changedPackages: ["typescript"],
  analysisPreparation: analysisPreparationWithValidRepoIntel(),
  repoIntelligence: fixtureRepoIntelligenceTypescript,
  decision: {
    recommendation: "safe",
    confidence: "high",
    reasoning: [],
  },
  graphInsights: {
    maxDepth: 4,
    nodes: 120,
    edges: 340,
    hotspots: [],
  },
};

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
  repoIntelligence: { invalid: true },
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
    reasoning: [],
  },
};
