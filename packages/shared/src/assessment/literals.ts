/** Assessment posture on the wire. */
export const ASSESSMENT_POSTURES = ["safe", "needs_review", "risky"] as const;

/** Engine confidence in the Assessment. */
export const ASSESSMENT_CONFIDENCES = ["low", "medium", "high"] as const;

/** Per-package change classification tokens. */
export const CHANGE_CLASSES = [
  "tooling_maintenance",
  "test_infra",
  "runtime_patch",
  "runtime_upgrade",
  "security_advisory",
  "breaking_change",
  "ecosystem_unknown",
  "bulk_mixed",
  "removal",
] as const;

/** Structured merge concern kinds. */
export const MERGE_CONCERN_KINDS = [
  "confirmed_runtime_usage",
  "security_finding",
  "breaking_or_major",
  "behavioral_change",
  "ecosystem_risk",
  "insufficient_evidence",
  "graph_baseline_only",
] as const;

/** Presentation narrative intensity. */
export const NARRATIVE_INTENSITIES = [
  "minimal",
  "standard",
  "elevated",
] as const;

/** Presentation reach visibility. */
export const REACH_VISIBILITIES = [
  "hidden",
  "contextual",
  "prominent",
] as const;

/** Presentation verification intensity. */
export const VERIFICATION_INTENSITIES = [
  "none",
  "advisory",
  "required",
] as const;

/** Presentation insight emission floor. */
export const INSIGHT_EMISSION_FLOORS = [
  "none",
  "explain_only",
  "full",
] as const;

/** Report presentation mode on wire. */
export const ASSESSMENT_REPORT_MODES = [
  "lightweight_pr_graph_baseline",
  "high_signal_pr",
] as const;

/** Review episode shape literals (Focal Point ABI 2). */
export const REVIEW_EPISODE_SHAPES = [
  "single_anchor",
  "multi_anchor",
  "parent_supporting",
  "coupled_pair",
  "tooling_bundle",
  "structural",
] as const;

/** Focal election dimension literals. */
export const FOCAL_ELECTION_DIMENSIONS = [
  "concern",
  "reach",
  "changeSeverity",
  "repository_importance",
  "role_salience_tiebreak",
] as const;

/** Reach bucket literals for {@link ReachScope.maxBucket}. */
export const REACH_BUCKETS = ["very_low", "low", "moderate", "high"] as const;

/**
 * Delta dimension kinds on the public Assessment clearance-envelope wire.
 * Minimal literal set required by assessmentSchema clearance validation.
 */
export const DELTA_DIMENSION_KINDS = [
  "manifest",
  "exports",
  "entrypoint",
  "peer_dependency",
  "engine_constraint",
  "type_surface",
  "artifact_layout",
  "documented_breaking",
] as const;

// --- ABI 4 outcome model literals ---

/** The four deterministic outcomes produced by Assessment (ABI 4). */
export const ASSESSMENT_OUTCOMES = [
  "cleared",
  "proven_broken",
  "bounded_verify",
  "abstain",
] as const;

/** Reasons for an Abstain outcome. */
export const ABSTAIN_REASON_KINDS = [
  "private_package",
  "opaque_mutation",
  "unsupported_ecosystem",
  "partial_monorepo_scan",
  "no_honest_bounded_target",
  "insufficient_collection",
] as const;

/** Blocker kinds for EvidenceSufficiencyVerdict. */
export const SUFFICIENCY_BLOCKER_KINDS = [
  "repository_coverage_insufficient",
  "package_facts_missing",
  "opaque_mutation",
  "private_package",
  "correlation_abstained",
  "proof_coverage_insufficient",
  "proof_execution_failed",
  "unsupported_ecosystem",
  "partial_monorepo_scan",
  "hypothesized_breaking_unresolved",
  "advisory_blocking",
  "conflicting_proof_results",
] as const;

/** Target kinds for BoundedVerifyTarget. */
export const BOUNDED_VERIFY_TARGET_KINDS = [
  "file_location",
  "config_path",
  "behavioral_scenario",
] as const;

/** Basis for a cleared delta dimension in ClearanceEnvelope. */
export const CLEARANCE_BASES = ["proof_pass", "no_impact_proven"] as const;

/** Reasons a delta dimension is uncleared in ClearanceEnvelope. */
export const UNCLEARED_REASONS = [
  "proof_failed",
  "proof_inconclusive",
  "no_producer_available",
  "representative_precision_only",
  "architectural_precision_only",
  "opaque_delta",
  "hypothesized_breaking",
] as const;

/** Coverage class for ClearanceEnvelope. */
export const COVERAGE_CLASSES = ["full", "representative", "none"] as const;
