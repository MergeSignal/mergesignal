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
