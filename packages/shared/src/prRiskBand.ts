import type { ScanNarrativeFacts } from "./scanNarrativeFacts.js";

/**
 * Canonical PR Risk band contract — sole authority for PR Risk band derivation.
 * Independent from legacy exposure presentation and merge verdict (`assessment.posture`).
 */

export const PR_RISK_BAND_ABI = "1" as const;

/** Inclusive upper bounds (0–100). Five stable PR Risk bands. */
export const PR_RISK_BAND_THRESHOLDS = [19, 44, 64, 84, 100] as const;

export type PrRiskBand = "very_low" | "low" | "medium" | "high" | "critical";

const BAND_LABEL: Record<PrRiskBand, string> = {
  very_low: "Very Low",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/** User-facing PR Risk band labels (low → high). */
export const PR_RISK_BAND_LABELS: readonly string[] = [
  BAND_LABEL.very_low,
  BAND_LABEL.low,
  BAND_LABEL.medium,
  BAND_LABEL.high,
  BAND_LABEL.critical,
];

const BAND_ORDER: readonly PrRiskBand[] = [
  "very_low",
  "low",
  "medium",
  "high",
  "critical",
];

/** Scan-detail gauge projection — not a second threshold table. */
export type PrRiskGaugeBand = "low" | "moderate" | "high";

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

/** Map numeric PR risk score to canonical band enum. */
export function scoreToBand(
  score: number | null | undefined,
): PrRiskBand | null {
  if (score == null || !Number.isFinite(score)) return null;
  const value = clampScore(score);
  const idx = PR_RISK_BAND_THRESHOLDS.findIndex((bound) => value <= bound);
  return BAND_ORDER[idx >= 0 ? idx : BAND_ORDER.length - 1]!;
}

/** Map numeric PR risk score to user-facing band label (presentation only). */
export function scoreToBandLabel(
  score: number | null | undefined,
): string | null {
  const band = scoreToBand(score);
  return band ? BAND_LABEL[band] : null;
}

/** Label for a known band enum value. */
export function prRiskBandLabel(band: PrRiskBand): string {
  return BAND_LABEL[band];
}

/** Fragment for composite aria labels on PR surfaces. */
export function prRiskBandAriaFragment(
  score: number | null | undefined,
): string | null {
  const label = scoreToBandLabel(score);
  if (!label) return null;
  return `PR Risk: ${label}`;
}

export type PrRiskSummary = {
  prRiskScore: number;
  prRiskBandLabel: string;
};

/** Format PR Risk score + band from narrative facts (not assessment projection). */
export function formatPrRiskSummary(
  facts: Pick<ScanNarrativeFacts, "riskSignals" | "riskIndex">,
): PrRiskSummary | undefined {
  const prRiskScore = facts.riskSignals?.riskIndex;
  if (prRiskScore == null || !Number.isFinite(prRiskScore)) return undefined;

  const prRiskBandLabelText =
    facts.riskSignals?.band != null
      ? prRiskBandLabel(facts.riskSignals.band)
      : scoreToBandLabel(prRiskScore);
  if (!prRiskBandLabelText) return undefined;

  return { prRiskScore, prRiskBandLabel: prRiskBandLabelText };
}

/** Project 5-band PR Risk to 3-bucket scan-detail gauge band. */
export function prRiskBandToGaugeBand(band: PrRiskBand): PrRiskGaugeBand {
  if (band === "critical" || band === "high") return "high";
  if (band === "medium") return "moderate";
  return "low";
}
