/**
 * Dashboard PR card copy — small fixed denylist (not an open-ended taxonomy).
 * Detail pages and check runs may show fuller engine text.
 */

/** Reasoning/summary lines too generic for card display. */
export const GENERIC_CARD_SUMMARY_PHRASES: readonly string[] = [
  "dependency change",
  "high-confidence merge risk",
  "high-confidence merge risks",
  "no high-confidence merge risk",
  "no high-confidence merge risks",
  "from this pr dependency change",
  "pr dependency change",
  "potential runtime impact detected",
  "potential runtime impact",
  "merge risk from this pr",
  "no merge blockers detected",
  "analysis could not be completed",
  "scan data unavailable",
  "waiting for results",
];

/** Area labels that repeat across many PRs — prefer omit over show. */
export const GENERIC_CARD_AREA_PHRASES: readonly string[] = [
  "auth flows",
  "api handlers",
  "api routes",
  "critical paths",
  "core services",
  "security",
  "maintainability",
  "ecosystem",
  "upgrade impact",
];

export const SAFE_LOW_FINDINGS_SUMMARY = "Minor findings only";

/** @deprecated Card UI omits this; kept for denormalized comparison only. */
export const LEGACY_SAFE_SUMMARY = "No merge blockers detected";
