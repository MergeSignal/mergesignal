/**
 * Dashboard card exposure semantics — display-only interpretation of totalScore.
 * Not persisted; not an engine output; complements merge posture (Safe / Review / Risky).
 */

export type CardExposureCategory =
  | "minimal"
  | "limited"
  | "moderate"
  | "elevated"
  | "broad";

export type CardExposureDisplay = {
  category: CardExposureCategory;
  /** User-facing label, e.g. "Moderate exposure". */
  label: string;
  value: number;
};

const EXPOSURE_LABEL: Record<CardExposureCategory, string> = {
  minimal: "Minimal exposure",
  limited: "Limited exposure",
  moderate: "Moderate exposure",
  elevated: "Elevated exposure",
  broad: "Broad exposure",
};

/** User-facing exposure labels for docs and UI copy (low → high). */
export const CARD_EXPOSURE_CATEGORY_LABELS: readonly string[] = [
  EXPOSURE_LABEL.minimal,
  EXPOSURE_LABEL.limited,
  EXPOSURE_LABEL.moderate,
  EXPOSURE_LABEL.elevated,
  EXPOSURE_LABEL.broad,
];

/** Inclusive upper bounds (0–100). Five stable buckets only. */
const EXPOSURE_UPPER_BOUND: readonly number[] = [24, 44, 74, 89, 100];

const EXPOSURE_ORDER: readonly CardExposureCategory[] = [
  "minimal",
  "limited",
  "moderate",
  "elevated",
  "broad",
];

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

/** Map numeric totalScore to a fixed exposure category (card UX only). */
export function deriveCardExposureDisplay(
  score: number | null | undefined,
): CardExposureDisplay | null {
  if (score == null || !Number.isFinite(score)) return null;
  const value = clampScore(score);
  const idx = EXPOSURE_UPPER_BOUND.findIndex((bound) => value <= bound);
  const category = EXPOSURE_ORDER[idx >= 0 ? idx : EXPOSURE_ORDER.length - 1]!;
  return { category, label: EXPOSURE_LABEL[category], value };
}

/** Compact card line: exposure category label only. */
export function formatCardExposureLine(
  score: number | null | undefined,
): string | null {
  const display = deriveCardExposureDisplay(score);
  if (!display) return null;
  return display.label;
}

/** Fragment for composite aria labels on PR cards. */
export function exposureAriaFragment(
  score: number | null | undefined,
): string | null {
  const display = deriveCardExposureDisplay(score);
  if (!display) return null;
  return display.label;
}
