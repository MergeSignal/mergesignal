import type { LayerScores, ScanResult } from "../types.js";

type Abi4SplitScores = {
  prRiskScore: number;
  repositoryHealthScore: number;
  layerScores?: LayerScores;
};

/**
 * Attach differentiated ABI-4+ prRisk + repositoryHealth wire blocks for modern
 * Assessment-era fixtures. Does not mirror health onto legacy root graph fields.
 */
export function withAbi4SplitScores<T extends ScanResult>(
  result: T,
  scores: Abi4SplitScores,
): T {
  const layerScores =
    scores.layerScores ??
    result.layerScores ??
    result.repositoryHealth?.layerScores;
  const {
    totalScore: _totalScore,
    layerScores: _layerScores,
    ...rest
  } = result;
  return {
    ...rest,
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
