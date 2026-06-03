import type {
  PRInsight,
  PRDecision,
  PRDecisionRecommendation,
} from "./types.js";

// Per-insight structured data — no title (title is per-comment, not per-insight)
export type FormattedInsight = {
  message: string;
  where: string;
  action: string;
};

const DECISION_TITLES: Record<PRDecisionRecommendation, string> = {
  safe: "No significant dependency risks detected",
  needs_review: "Elevated dependency merge risk",
  risky: "Merge blocked - critical dependency risk",
};

// Title rendered once per PR comment, not per insight
export function decisionTitle(
  recommendation: PRDecisionRecommendation,
): string {
  return DECISION_TITLES[recommendation];
}

/**
 * Normalizes typographic punctuation to ASCII equivalents so that LLM output
 * renders consistently across PR comments, the web UI, and CLI output.
 * Only targets characters that cause visual/encoding inconsistency; other
 * characters (including XSS payloads) are passed through unchanged — HTML
 * escaping is the renderer's responsibility.
 */
function normalizeToAscii(s: string): string {
  return s
    .replace(/\u2014/g, "-") // em dash —
    .replace(/\u2013/g, "-"); // en dash –
}

// Maps one PRInsight to its display fields (no title)
export function formatInsight(insight: PRInsight): FormattedInsight {
  return {
    message: normalizeToAscii(insight.message),
    where: normalizeToAscii(insight.context),
    action: normalizeToAscii(insight.remediation),
  };
}

// Renders a single formatted insight as markdown (no title, no divider)
function renderInsightAsMarkdown(f: FormattedInsight): string {
  return [
    f.message,
    "",
    "**Where it shows up**",
    "",
    f.where,
    "",
    "**What to do**",
    "",
    f.action,
  ].join("\n");
}

export { renderInsightsAsMarkdown } from "./presentGitHubPrComment.js";
