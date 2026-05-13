import type {
  ScanRequest,
  ScanResult,
  UpgradeSimulationRequest,
  UpgradeSimulationResult,
} from "@mergesignal/shared";

const METHODOLOGY_VERSION = "engine-test-fixture/v1";

const minimalScan = (repoId: string): ScanResult => ({
  totalScore: 12,
  layerScores: {
    security: 10,
    maintainability: 10,
    ecosystem: 15,
    upgradeImpact: 13,
  },
  findings: [],
  recommendations: [],
  generatedAt: new Date().toISOString(),
  methodologyVersion: METHODOLOGY_VERSION,
  confidence: "high",
  decision: {
    recommendation: "safe",
    confidence: "high",
    reasoning: [],
  },
  insights: [],
  signals: [],
});

export async function analyze(req: ScanRequest): Promise<ScanResult> {
  return minimalScan(req.repoId);
}

export async function simulateUpgrade(
  _req: UpgradeSimulationRequest,
): Promise<UpgradeSimulationResult> {
  const before = minimalScan("fixture");
  return {
    before,
    after: { ...before, totalScore: 11 },
    delta: { totalScoreDelta: -1 },
    generatedAt: new Date().toISOString(),
  };
}
