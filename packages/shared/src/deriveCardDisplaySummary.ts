import {
  GENERIC_CARD_SUMMARY_PHRASES,
  LEGACY_SAFE_SUMMARY,
  SAFE_LOW_FINDINGS_SUMMARY,
} from "./cardSummaryCopy.js";
import { joinCardAreaLabels } from "./formatCardAreaLabels.js";
import { truncateCardSummary } from "./truncateCardSummary.js";
import type { FindingCountSummary } from "./scanCardSummary.js";
import type { MergePosture } from "./riskVocabulary.js";

function hasActionableFindings(counts: FindingCountSummary): boolean {
  return counts.critical + counts.high + counts.medium + counts.low > 0;
}

function hasOnlyLowFindings(counts: FindingCountSummary): boolean {
  return (
    counts.low > 0 &&
    counts.critical === 0 &&
    counts.high === 0 &&
    counts.medium === 0
  );
}

/** True when summary text is too generic for dashboard cards. */
export function isGenericCardSummary(text: string | null | undefined): boolean {
  if (!text?.trim()) return true;
  const normalized = text.trim().toLowerCase();
  if (normalized.length < 12) return true;
  return GENERIC_CARD_SUMMARY_PHRASES.some((phrase) =>
    normalized.includes(phrase),
  );
}

export type DeriveCardDisplaySummaryInput = {
  mergePosture: MergePosture | null;
  rawSummary: string | null | undefined;
  findingCounts: FindingCountSummary | null;
  topAffectedAreas: string[];
};

/**
 * Dashboard card summary line — operational, concise, posture-aware.
 * Returns null for quiet safe cards (posture-only display).
 */
export function deriveCardDisplaySummary(
  input: DeriveCardDisplaySummaryInput,
): string | null {
  const { mergePosture, rawSummary, findingCounts, topAffectedAreas } = input;
  if (!mergePosture) return rawSummary?.trim() || null;

  const counts = findingCounts ?? {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  if (mergePosture === "safe") {
    if (!hasActionableFindings(counts)) {
      const areasLine = joinCardAreaLabels(topAffectedAreas);
      if (areasLine) return truncateCardSummary(areasLine, 90);
      return null;
    }
    if (hasOnlyLowFindings(counts)) return SAFE_LOW_FINDINGS_SUMMARY;
  }

  const raw = rawSummary?.trim() ?? null;
  if (raw && raw !== LEGACY_SAFE_SUMMARY && !isGenericCardSummary(raw)) {
    return truncateCardSummary(raw);
  }

  const areasLine = joinCardAreaLabels(topAffectedAreas);
  if (areasLine) return truncateCardSummary(areasLine, 90);

  if (mergePosture === "safe") return null;

  return null;
}
