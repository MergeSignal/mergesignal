import type { PRDecisionRecommendation } from "./types.js";

// =============================================================================
// Canonical risk vocabulary — single source of truth for user-facing strings.
//
// Merge posture wire values are exactly `MERGE_POSTURE_RECOMMENDATIONS` in
// `@mergesignal/shared` types / scan schema; engines must not emit alternate
// tokens (e.g. uppercase variants) on `ScanResult.decision.recommendation`.
//
// Two separate tiers (never mix as peer labels in the same UI context):
//
//   MergePosture — the PR/repo verdict headline (Safe / Needs review / Risky).
//   SignalSeverity — granular hazard level on individual findings (Low/Med/High).
//
// Numeric risk score stays numeric; color bands are applied via tokens but the
// label itself is never remapped to a Low/Medium/High word at card level.
// =============================================================================

export type MergePosture = PRDecisionRecommendation;

/** Canonical display strings for merge posture values. */
export const MERGE_POSTURE_LABEL: Record<MergePosture, string> = {
  safe: "Safe",
  needs_review: "Needs review",
  risky: "Risky",
};

/**
 * Sorting weights: higher number = listed first (riskiest first).
 * Use as: arr.sort((a, b) => MERGE_POSTURE_SORT_ORDER[b] - MERGE_POSTURE_SORT_ORDER[a])
 */
export const MERGE_POSTURE_SORT_ORDER: Record<MergePosture, number> = {
  risky: 2,
  needs_review: 1,
  safe: 0,
};

/** Normalize a raw `decision` string to a typed MergePosture, or null. */
export function mergePostureFromDecision(
  decision: string | null | undefined,
): MergePosture | null {
  if (
    decision === "safe" ||
    decision === "needs_review" ||
    decision === "risky"
  ) {
    return decision;
  }
  return null;
}

/** Returns the display label for a decision, or a fallback string. */
export function mergePostureLabel(
  decision: string | null | undefined,
  fallback = "—",
): string {
  const posture = mergePostureFromDecision(decision);
  return posture ? MERGE_POSTURE_LABEL[posture] : fallback;
}

/**
 * Accessible composite label for a merge posture badge.
 * e.g. "Risky, risk score 72" or "Safe"
 */
export function ariaLabelForPosture(
  decision: string | null | undefined,
  score: number | null | undefined,
): string {
  const label = mergePostureLabel(decision);
  if (score != null) return `${label}, risk score ${Math.round(score)}`;
  return label;
}

/** Accessible label for unified PR card risk block. */
export function ariaLabelForCardSummary(
  headline: string,
  riskIndex: number | null | undefined,
  summaryLine: string | null | undefined,
): string {
  const parts = [headline];
  if (riskIndex != null) parts.push(`risk index ${Math.round(riskIndex)}`);
  if (summaryLine?.trim()) parts.push(summaryLine.trim());
  return parts.join(". ");
}

// =============================================================================
// Signal severity — only for granular findings; always qualified in copy.
// =============================================================================

export type SignalSeverity = "low" | "medium" | "high";

const SIGNAL_SEVERITY_LABEL: Record<SignalSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * Format a signal severity for prose use — always returns a qualified string
 * so it cannot be confused with merge posture at a glance.
 * e.g. "Severity: High"
 */
export function formatSignalSeverity(severity: string): string {
  const s = severity.toLowerCase() as SignalSeverity;
  const label = SIGNAL_SEVERITY_LABEL[s] ?? severity;
  return `Severity: ${label}`;
}

/**
 * Format a count + severity for compact prose.
 * e.g. "3 high-severity findings"
 */
export function formatSeverityCount(count: number, severity: string): string {
  const s = severity.toLowerCase();
  return `${count} ${s}-severity finding${count !== 1 ? "s" : ""}`;
}
