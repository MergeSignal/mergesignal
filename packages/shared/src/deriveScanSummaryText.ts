import type { ScanResult } from "./types.js";

/**
 * One-line summary for PR scan list cards (server or client).
 * Prefers decision reasoning, then finding severity counts.
 */
export function deriveScanSummaryText(
  result: ScanResult | null | undefined,
): string | null {
  if (!result) return null;

  const decision = result.decision;
  const reasoning = decision?.reasoning;
  if (Array.isArray(reasoning) && reasoning.length > 0) {
    const first = String(reasoning[0]).trim();
    return first.length > 120 ? first.slice(0, 119) + "…" : first;
  }

  const findings = result.findings;
  if (Array.isArray(findings) && findings.length > 0) {
    const high = findings.filter((f) => f.severity === "high").length;
    const medium = findings.filter((f) => f.severity === "medium").length;
    if (high > 0)
      return `${high} high-severity finding${high > 1 ? "s" : ""} detected`;
    if (medium > 0)
      return `${medium} medium-severity finding${medium > 1 ? "s" : ""} detected`;
  }

  return null;
}
