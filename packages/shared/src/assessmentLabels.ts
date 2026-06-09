import type { MergeConcernKind } from "./assessmentSchema.js";

/** Display labels for factor tokens (mirrors engine factor-registry labels). */
export const ASSESSMENT_FACTOR_LABELS: Record<string, string> = {
  confirmed_runtime_usage: "Confirmed runtime usage",
  queue_infrastructure: "Queue infrastructure",
  http_framework_infrastructure: "HTTP framework infrastructure",
  auth_infrastructure: "Authentication infrastructure",
  moderate_reach: "Moderate repository reach",
  high_reach: "High repository reach",
  low_reach: "Low repository reach",
  tooling_maintenance: "Tooling maintenance change",
  test_infra_change: "Test infrastructure change",
  security_advisory: "Security advisory",
  breaking_or_major_change: "Breaking or major version change",
  behavioral_change_risk: "Behavioral change risk",
  ecosystem_unknown_package: "Unknown ecosystem package",
  insufficient_collection_evidence: "Insufficient collection evidence",
  graph_baseline_only: "Repository graph baseline only",
  verification_required: "Verification focus required",
  runtime_upgrade: "Runtime dependency upgrade",
  runtime_patch: "Runtime dependency patch",
};

export const MERGE_CONCERN_LABELS: Record<MergeConcernKind, string> = {
  confirmed_runtime_usage:
    "Changed package has confirmed usage on runtime application paths in this repository.",
  security_finding:
    "Security advisory or vulnerability finding affects changed dependencies.",
  breaking_or_major:
    "Breaking change or major version bump warrants explicit review.",
  behavioral_change: "Behavioral change risk detected on changed dependencies.",
  ecosystem_risk:
    "Changed package has limited classification evidence; review dependency signals.",
  insufficient_evidence:
    "Collection evidence is partial; confidence is reduced but review posture is preserved when runtime signals exist.",
  graph_baseline_only:
    "Repository dependency graph baseline evaluated; no PR-specific merge concerns detected on changed packages.",
};

export function labelAssessmentFactor(token: string): string {
  return ASSESSMENT_FACTOR_LABELS[token] ?? token.replace(/_/g, " ");
}
