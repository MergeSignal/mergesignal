export type PipelineStatus = "queued" | "running" | "done" | "failed";

export type PresentationStatus = "safe" | "needs_review" | "risky";

export type PresentationDensity = "minimal" | "standard" | "rich";

export type PresentationConfidence = "high" | "medium" | "low";

export type PresentationPriority = "pr_intelligence" | "limited";

export type PresentationEvidenceRow = { label: string; value: string };

/** User-facing evidence summary - mirrors profile.priority */
export type PresentationEvidenceContext = {
  priority: PresentationPriority;
  degradedMessage?: string;
};

export type FindingCountSummary = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export function aggregateFindingCounts(
  findings: Array<{ severity: string }> | null | undefined,
): FindingCountSummary {
  const counts: FindingCountSummary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  if (!Array.isArray(findings)) return counts;
  for (const f of findings) {
    const s = f.severity;
    if (s === "critical") counts.critical += 1;
    else if (s === "high") counts.high += 1;
    else if (s === "medium") counts.medium += 1;
    else if (s === "low") counts.low += 1;
  }
  return counts;
}
