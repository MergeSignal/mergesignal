import { MERGE_POSTURE_LABEL } from "./riskVocabulary.js";
import type { PRInsight, PRDecision } from "./types.js";

// Per-insight structured data — no title (title is per-comment, not per-insight)
type FormattedInsight = {
  message: string;
  where: string;
  action: string;
};

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

function renderInsightBlock(f: FormattedInsight): string {
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

/** Legacy markdown renderer for raw PR insights (format-only; no bundle inference). */
export function renderInsightsAsMarkdown(
  insights: PRInsight[],
  decision: PRDecision,
): string {
  const title = MERGE_POSTURE_LABEL[decision.recommendation];
  const lines: string[] = [`**${title}**`, "", "---", ""];
  for (const insight of insights) {
    lines.push(renderInsightBlock(formatInsight(insight)), "", "---", "");
  }
  for (const reason of decision.reasoning) {
    lines.push(reason);
  }
  return lines.join("\n");
}
