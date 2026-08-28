import type {
  Assessment,
  CodeAnalysisInput,
  LayerScores,
  ScanRequest,
  ScanResult,
  UpgradeSimulationRequest,
  UpgradeSimulationResult,
} from "@mergesignal/shared";

const METHODOLOGY_VERSION = "engine-test-fixture/v1";

function isChangeRequestScope(req: ScanRequest): boolean {
  return req.scanAnalysisScope === "change_request";
}

/** Self-contained ABI-3 assessment — no runtime @mergesignal/shared import (Docker fixture engine). */
const FIXTURE_ASSESSMENT: Assessment = {
  reasoning: [],
  confidenceRationale: "",
  reviewFocalPoint: {
    episodeShape: "single_anchor",
    anchors: ["typescript"],
    election: {
      grounding: [
        {
          packageName: "typescript",
          reason: "fixture",
          decidedBy: "reach",
          evidenceRefs: ["fixture:focal"],
        },
      ],
      exclusions: [],
    },
  },
  reachScope: { packages: [], maxBucket: "very_low" },
  verificationScope: {
    packages: [],
    focus: [],
    artifactGrounded: {
      packages: ["typescript"],
      focus: ["typecheck"],
      artifactPaths: ["package.json"],
    },
  },
  posture: "safe",
  confidence: "high",
  primaryConcern: null,
  concerns: [],
  factors: ["tooling_maintenance"],
  changeClasses: ["tooling_maintenance"],
  presentation: {
    narrativeIntensity: "minimal",
    reachVisibility: "hidden",
    verificationIntensity: "advisory",
    insightEmissionFloor: "none",
    reportMode: "high_signal_pr",
  },
};

/** Repository-scoped synthetic scan with a guaranteed root graph score (fixture upgrade path). */
type RepositoryScopedFixtureScanResult = ScanResult & {
  totalScore: number;
  layerScores: LayerScores;
};

function buildRepositoryScopedFixtureScan(
  totalScore: number,
): RepositoryScopedFixtureScanResult {
  const layerScores: LayerScores = {
    security: 10,
    maintainability: 10,
    ecosystem: 15,
    upgradeImpact: 13,
  };
  return {
    totalScore,
    layerScores,
    findings: [],
    recommendations: [],
    generatedAt: new Date().toISOString(),
    methodologyVersion: METHODOLOGY_VERSION,
    confidence: "high",
    assessment: FIXTURE_ASSESSMENT,
    decision: {
      recommendation: "safe",
      confidence: "high",
      reasoning: [
        "No dedicated dependency review required beyond normal engineering process.",
      ],
    },
    insights: [],
    signals: [],
  };
}

const minimalRepositoryScan = (
  repoId: string,
): RepositoryScopedFixtureScanResult => buildRepositoryScopedFixtureScan(12);

const minimalChangeRequestScan = (): ScanResult => {
  const layerScores: LayerScores = {
    security: 10,
    maintainability: 10,
    ecosystem: 15,
    upgradeImpact: 13,
  };
  const totalScore = 12;
  return {
    prRisk: { score: totalScore, layerScores },
    repositoryHealth: { totalScore, layerScores },
    findings: [],
    recommendations: [],
    generatedAt: new Date().toISOString(),
    methodologyVersion: METHODOLOGY_VERSION,
    assessment: FIXTURE_ASSESSMENT,
    decision: {
      recommendation: "safe",
      confidence: "high",
      reasoning: [
        "No dedicated dependency review required beyond normal engineering process.",
      ],
    },
    insights: [],
    signals: [],
    changedPackages: [],
  };
};

function minimalScan(req: ScanRequest): ScanResult {
  return isChangeRequestScope(req)
    ? minimalChangeRequestScan()
    : minimalRepositoryScan(req.repoId);
}

export async function analyze(
  req: ScanRequest,
  codeAnalysis?: CodeAnalysisInput,
): Promise<ScanResult> {
  const base = minimalScan(req);
  if (codeAnalysis && codeAnalysis.fileContents.size > 0) {
    return {
      ...base,
      changedPackages: req.changedPackages ?? codeAnalysis.changedPackages,
      repoIntelligence: {
        packages: {
          [(req.changedPackages ?? [])[0] ?? "app"]: {
            runtimeSurface: "runtime",
            reachability: "on_runtime_paths",
          },
        },
        blastRadius: { level: "moderate", changedPackageCount: 1 },
      },
      codeAnalysisMetrics: {
        fromCache: false,
        filesAnalyzed: codeAnalysis.fileContents.size,
      },
    };
  }
  return base;
}

export async function simulateUpgrade(
  _req: UpgradeSimulationRequest,
): Promise<UpgradeSimulationResult> {
  const before = buildRepositoryScopedFixtureScan(12);
  const after = buildRepositoryScopedFixtureScan(11);
  return {
    before,
    after,
    delta: { totalScoreDelta: after.totalScore - before.totalScore },
    generatedAt: new Date().toISOString(),
  };
}
