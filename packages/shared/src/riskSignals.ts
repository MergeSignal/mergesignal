import { scoreToBand, type PrRiskBand } from "./prRiskBand.js";
import { resolvePrRiskLayerScores, resolvePrRiskScore } from "./prRiskWire.js";
import type { LayerScores, ScanResult, ScoreLayer } from "./types.js";

export type RiskSignalLayer = {
  layer: ScoreLayer;
  score: number;
  band: PrRiskBand;
};

/** Canonical PR Risk classification for prRisk.score and layer scores. */
export type RiskSignals = {
  riskIndex: number | null;
  band: PrRiskBand | null;
  layers: RiskSignalLayer[];
};

const LAYER_ORDER: ScoreLayer[] = [
  "security",
  "maintainability",
  "ecosystem",
  "upgradeImpact",
];

/**
 * Single owner for PR risk index + band classification.
 * Surfaces must consume `facts.riskSignals` — do not re-derive bands.
 */
export function deriveRiskSignals(result: ScanResult): RiskSignals | null {
  const riskIndex = resolvePrRiskScore(result);
  const layerScores: LayerScores | null = resolvePrRiskLayerScores(result);

  if (riskIndex == null && layerScores == null) {
    return null;
  }

  const band = scoreToBand(riskIndex);
  const layers: RiskSignalLayer[] = layerScores
    ? LAYER_ORDER.map((layer) => {
        const score = layerScores[layer];
        return {
          layer,
          score,
          band: scoreToBand(score) ?? "very_low",
        };
      })
    : [];

  return { riskIndex, band, layers };
}
