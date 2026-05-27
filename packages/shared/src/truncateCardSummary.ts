/**
 * Semantic truncation for dashboard card summaries (~90 chars default).
 */

const DEFAULT_MAX = 90;

export function truncateCardSummary(
  text: string,
  maxLen: number = DEFAULT_MAX,
): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;

  const slice = trimmed.slice(0, maxLen + 1);

  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (sentenceEnd >= Math.floor(maxLen * 0.45)) {
    return trimmed.slice(0, sentenceEnd + 1).trim();
  }

  const clauseEnd = Math.max(
    slice.lastIndexOf(", "),
    slice.lastIndexOf("; "),
    slice.lastIndexOf(" — "),
    slice.lastIndexOf(" - "),
  );
  if (clauseEnd >= Math.floor(maxLen * 0.45)) {
    return `${trimmed.slice(0, clauseEnd).trim()}…`;
  }

  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace >= Math.floor(maxLen * 0.6)) {
    return `${trimmed.slice(0, lastSpace).trim()}…`;
  }

  return `${trimmed.slice(0, maxLen).trim()}…`;
}
