import type {
  Assessment,
  CodeAnalysisInput,
  ScanRequest,
  ScanResult,
  UpgradeSimulationRequest,
  UpgradeSimulationResult,
} from "@mergesignal/shared";

const METHODOLOGY_VERSION = "engine-test-fixture/v1";

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

const minimalScan = (repoId: string): ScanResult => {
  const layerScores = {
    security: 10,
    maintainability: 10,
    ecosystem: 15,
    upgradeImpact: 13,
  };
  const totalScore = 12;
  return {
    totalScore,
    layerScores,
    prRisk: { score: totalScore, layerScores },
    repositoryHealth: { totalScore, layerScores },
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
};

export async function analyze(
  req: ScanRequest,
  codeAnalysis?: CodeAnalysisInput,
): Promise<ScanResult> {
  const base = minimalScan(req.repoId);
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
  const before = minimalScan("fixture");
  return {
    before,
    after: { ...before, totalScore: 11 },
    delta: { totalScoreDelta: -1 },
    generatedAt: new Date().toISOString(),
  };
}
