import type {
  CodeAnalysisInput,
  ScanRequest,
  ScanResult,
  UpgradeSimulationRequest,
  UpgradeSimulationResult,
} from "@mergesignal/shared";

const METHODOLOGY_VERSION = "engine-stub/v2";

function buildMockResult(): ScanResult {
  return {
    totalScore: 25,
    layerScores: {
      security: 20,
      maintainability: 15,
      ecosystem: 30,
      upgradeImpact: 35,
    },
    findings: [],
    signals: [
      {
        id: "stub-signal-1",
        layer: "security",
        name: "Stub signal",
        value: 0,
        weight: 1,
        scoreImpact: 0,
      },
    ],
    recommendations: [
      {
        id: "stub-rec-1",
        title: "Stub recommendation - actual analysis unavailable",
        rationale:
          "This is a placeholder result from the stub implementation. Install the proprietary engine for real analysis.",
        impact: "low",
        rank: 1,
        priorityScore: 10,
      },
    ],
    insights: [],
    decision: {
      recommendation: "needs_review",
      confidence: "low",
      reasoning: ["Stub engine cannot perform real analysis"],
    },
    methodologyVersion: METHODOLOGY_VERSION,
    confidence: "low",
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Stub implementation of the analyze function.
 * The actual analysis engine is proprietary and located in a private repository.
 * This returns mock data for demonstration purposes.
 */
export async function analyze(
  req: ScanRequest,
  codeAnalysis?: CodeAnalysisInput,
): Promise<ScanResult> {
  console.warn(
    "⚠️  Using stub engine - analysis results are mocked for demonstration only",
  );
  const base = buildMockResult();
  if (codeAnalysis && codeAnalysis.fileContents.size > 0) {
    return {
      ...base,
      changedPackages: req.changedPackages ?? codeAnalysis.changedPackages,
      repoIntelligence: { packages: {} },
      codeAnalysisMetrics: {
        fromCache: false,
        filesAnalyzed: codeAnalysis.fileContents.size,
      },
    };
  }
  return base;
}

/**
 * Stub implementation of the simulateUpgrade function.
 * The actual upgrade simulation engine is proprietary and located in a private repository.
 * This returns mock data for demonstration purposes.
 */
export async function simulateUpgrade(
  _req: UpgradeSimulationRequest,
): Promise<UpgradeSimulationResult> {
  console.warn(
    "⚠️  Using stub engine - upgrade simulation results are mocked for demonstration only",
  );

  const before = buildMockResult();
  const after = { ...buildMockResult(), totalScore: 30 };

  return {
    before,
    after,
    delta: {
      totalScoreDelta: after.totalScore - before.totalScore,
      layerScoreDeltas: {},
      dependencyDelta: {
        directAdded: 0,
        directRemoved: 0,
        directUpdated: 1,
        packagesAdded: 0,
        packagesRemoved: 0,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}
