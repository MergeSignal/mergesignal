import type { LayerScores, ScanResult } from "../types.js";

/** Attach ABI-4 prRisk + repositoryHealth wire blocks for strict engine validation tests. */
export function withAbi4EngineScores<T extends ScanResult>(result: T): T {
  const score = result.totalScore;
  const layerScores = result.layerScores;
  return {
    ...result,
    prRisk: result.prRisk ?? { score, layerScores },
    repositoryHealth: result.repositoryHealth ?? {
      totalScore: score,
      layerScores,
    },
  };
}
