/**
 * Single source for short scan pipeline / Actions copy (not i18n — keep flat and small).
 * Risk / merge posture labels stay in riskVocabulary / MERGE_POSTURE_LABEL.
 */

export const scanSurfaceCopy = {
  pipeline: {
    scanRunning: "Scan in progress",
    scanIncomplete: "Waiting for scan results",
    scanUnavailable: "Scan data unavailable",
    analysisIncomplete: "Analysis could not be completed",
    outputNotVerified: "These results could not be verified",
  },
  actions: {
    failureTitle: "MergeSignal",
    failureBody:
      "Analysis could not be completed. Check the workflow logs for details.",
    demoSummaryTitle: "MergeSignal (demo output)",
    demoSummaryBanner:
      "Sample analysis only — not production MergeSignal results. Do not use for merge decisions.",
    trustedSummaryMethodologyLine: "Methodology",
  },
  cli: {
    stderrAnalysisIncomplete: "Analysis could not be completed.",
    stderrOutputNotVerified: "These results could not be verified.",
  },
} as const;

/** Flatten for `scripts/ci/*.mjs` consumers (generated JSON). */
export function scanSurfaceCopyFlat(): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (prefix: string, obj: unknown) => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "string") out[key] = v;
        else walk(key, v);
      }
    }
  };
  walk("", scanSurfaceCopy);
  return out;
}
