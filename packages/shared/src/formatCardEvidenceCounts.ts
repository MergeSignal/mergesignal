import type { FindingCountSummary } from "./scanCardSummary.js";
import type { MergePosture } from "./riskVocabulary.js";

/**
 * One soft evidence phrase for dashboard cards (not scanner-style metrics).
 */
export function formatCardEvidenceCounts(
  counts: FindingCountSummary | null | undefined,
  posture: MergePosture | null,
): string | null {
  if (!counts || !posture || posture === "safe") return null;

  const { critical, high } = counts;
  if (critical > 0 && posture === "risky") {
    if (critical === 1) return "1 critical finding";
    return "Critical findings present";
  }
  if (high > 0 && (posture === "risky" || posture === "needs_review")) {
    if (high === 1) return "1 high-severity finding";
    return `${high} high-severity findings`;
  }
  return null;
}
