import { layerRiskBandLabel } from "./actionsStepSummary.js";
import { mergePostureFromDecision } from "./riskVocabulary.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import type { ScanResult, ScoreLayer } from "./types.js";

export const SCAN_DETAIL_RISK_BAND_MODERATE_MIN = 40;
export const SCAN_DETAIL_RISK_BAND_HIGH_MIN = 80;

const LAYER_ORDER: readonly ScoreLayer[] = [
  "security",
  "maintainability",
  "ecosystem",
  "upgradeImpact",
];

const LAYER_LABEL: Record<ScoreLayer, string> = {
  security: "Security",
  maintainability: "Maintainability",
  ecosystem: "Ecosystem",
  upgradeImpact: "Upgrade Impact",
};

export type ScanDetailOverallRiskBand = "low" | "moderate" | "high";
export type ScanDetailLayerConcernLevel = "low" | "medium" | "high";

export type ScanDetailSignalLayer = {
  layer: ScoreLayer;
  label: string;
  score: number;
  concernLevel: ScanDetailLayerConcernLevel;
  concernLabel: string;
};

/** @deprecated Use ScanDetailSignalLayer */
export type ScanDetailRiskLayer = ScanDetailSignalLayer;

export type RiskScoreGaugeModel = {
  fillPercent: number;
  band: ScanDetailOverallRiskBand;
  ariaLabel: string;
};

export type ScanDetailSignalSummary = {
  score: number;
  overallBand: ScanDetailOverallRiskBand;
  overallLabel: string;
  gauge: RiskScoreGaugeModel;
  layers: ScanDetailSignalLayer[];
  postureMismatchNote?: string;
};

/** @deprecated Use ScanDetailSignalSummary */
export type ScanDetailRiskSummary = ScanDetailSignalSummary;

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function deriveOverallRiskBand(
  score: number | null | undefined,
): ScanDetailOverallRiskBand {
  if (score == null || !Number.isFinite(score)) return "low";
  const value = clampScore(score);
  if (value >= SCAN_DETAIL_RISK_BAND_HIGH_MIN) return "high";
  if (value >= SCAN_DETAIL_RISK_BAND_MODERATE_MIN) return "moderate";
  return "low";
}

export function overallSignalBandLabel(
  band: ScanDetailOverallRiskBand,
): string {
  const copy = scanSurfaceCopy.scanDetail.signalSummary.bandLabel;
  if (band === "high") return copy.high;
  if (band === "moderate") return copy.moderate;
  return copy.low;
}

/** @deprecated Use overallSignalBandLabel */
export const overallRiskBandLabel = overallSignalBandLabel;

function layerBandToSignal(band: string): {
  level: ScanDetailLayerConcernLevel;
  label: string;
} {
  const copy = scanSurfaceCopy.scanDetail.signalSummary.signalLabel;
  if (band === "High") {
    return { level: "high", label: copy.high };
  }
  if (band === "Moderate") {
    return { level: "medium", label: copy.medium };
  }
  return { level: "low", label: copy.low };
}

export function deriveRiskScoreGauge(
  score: number,
  band: ScanDetailOverallRiskBand,
): RiskScoreGaugeModel {
  const clamped = clampScore(score);
  return {
    fillPercent: clamped,
    band,
    ariaLabel: scanSurfaceCopy.scanDetail.signalSummary.gaugeAriaLabel
      .replace("{score}", String(clamped))
      .replace("{band}", overallSignalBandLabel(band)),
  };
}

export function deriveSignalSummary(
  result: ScanResult,
): ScanDetailSignalSummary | null {
  if (
    typeof result.totalScore !== "number" ||
    !Number.isFinite(result.totalScore)
  ) {
    return null;
  }

  const score = clampScore(result.totalScore);
  const overallBand = deriveOverallRiskBand(score);
  const overallLabel = overallSignalBandLabel(overallBand);
  const gauge = deriveRiskScoreGauge(score, overallBand);

  const layers: ScanDetailSignalLayer[] = LAYER_ORDER.map((layer) => {
    const layerScore =
      typeof result.layerScores?.[layer] === "number"
        ? clampScore(result.layerScores[layer]!)
        : 0;
    const band = layerRiskBandLabel(layerScore);
    const signal = layerBandToSignal(band);
    return {
      layer,
      label: LAYER_LABEL[layer],
      score: layerScore,
      concernLevel: signal.level,
      concernLabel: signal.label,
    };
  });

  const posture = mergePostureFromDecision(result.decision?.recommendation);
  const postureMismatchNote =
    posture === "safe" && (overallBand === "moderate" || overallBand === "high")
      ? scanSurfaceCopy.scanDetail.signalSummary.postureMismatchNote
      : undefined;

  return {
    score,
    overallBand,
    overallLabel,
    gauge,
    layers,
    postureMismatchNote,
  };
}

/** @deprecated Use deriveSignalSummary */
export const deriveRiskScoreSummary = deriveSignalSummary;
