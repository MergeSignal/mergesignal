import type { LayerScores, ScanResult } from "../types.js";
import { normalizeEngineOutputAbi4 } from "../scanResultSchema.js";

type Abi4SplitScores = {
  prRiskScore: number;
  repositoryHealthScore: number;
  layerScores?: LayerScores;
};

/**
 * Attach differentiated ABI-4 prRisk + repositoryHealth wire blocks.
 * `totalScore` mirrors repository health for legacy readers; presentation must
 * consume `prRisk.score` via `deriveRiskSignals()`.
 */
export function withAbi4SplitScores<T extends ScanResult>(
  result: T,
  scores: Abi4SplitScores,
): T {
  const layerScores = scores.layerScores ?? result.layerScores;
  return {
    ...result,
    totalScore: scores.repositoryHealthScore,
    layerScores,
    prRisk: {
      score: scores.prRiskScore,
      layerScores: result.prRisk?.layerScores ?? layerScores,
    },
    repositoryHealth: {
      totalScore: scores.repositoryHealthScore,
      layerScores,
    },
  };
}

/** Attach ABI-4 prRisk + repositoryHealth wire blocks for strict engine validation tests. */
export function withAbi4EngineScores<T extends ScanResult>(result: T): T {
  return normalizeEngineOutputAbi4(result) as T;
}
