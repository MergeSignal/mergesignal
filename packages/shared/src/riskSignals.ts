import {
  deriveCardExposureCategory,
  type CardExposureCategory,
} from "./formatCardExposureDisplay.js";
import type { LayerScores, ScanResult, ScoreLayer } from "./types.js";

export type RiskSignalLayer = {
  layer: ScoreLayer;
  score: number;
  exposure: CardExposureCategory;
};

/** Canonical exposure classification for totalScore and layerScores. */
export type RiskSignals = {
  riskIndex: number | null;
  exposure: CardExposureCategory | null;
  layers: RiskSignalLayer[];
};

const LAYER_ORDER: ScoreLayer[] = [
  "security",
  "maintainability",
  "ecosystem",
  "upgradeImpact",
];

/**
 * Single owner for numeric risk index + exposure bucket classification.
 * Surfaces must consume `facts.riskSignals` in future phases — do not re-derive bands.
 */
export function deriveRiskSignals(result: ScanResult): RiskSignals | null {
  const riskIndex =
    typeof result.totalScore === "number" && Number.isFinite(result.totalScore)
      ? result.totalScore
      : null;
  const layerScores: LayerScores | undefined = result.layerScores;

  if (riskIndex == null && layerScores == null) {
    return null;
  }

  const exposure = deriveCardExposureCategory(riskIndex);
  const layers: RiskSignalLayer[] = layerScores
    ? LAYER_ORDER.map((layer) => {
        const score = layerScores[layer];
        return {
          layer,
          score,
          exposure: deriveCardExposureCategory(score) ?? "minimal",
        };
      })
    : [];

  return { riskIndex, exposure, layers };
}
