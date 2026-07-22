import type {
  ABSTAIN_REASON_KINDS,
  ASSESSMENT_CONFIDENCES,
  ASSESSMENT_OUTCOMES,
  ASSESSMENT_POSTURES,
  ASSESSMENT_REPORT_MODES,
  BOUNDED_VERIFY_TARGET_KINDS,
  CHANGE_CLASSES,
  CLEARANCE_BASES,
  COVERAGE_CLASSES,
  DELTA_DIMENSION_KINDS,
  FOCAL_ELECTION_DIMENSIONS,
  INSIGHT_EMISSION_FLOORS,
  MERGE_CONCERN_KINDS,
  NARRATIVE_INTENSITIES,
  REACH_BUCKETS,
  REACH_VISIBILITIES,
  REVIEW_EPISODE_SHAPES,
  SUFFICIENCY_BLOCKER_KINDS,
  UNCLEARED_REASONS,
  VERIFICATION_INTENSITIES,
} from "./literals.js";

/**
 * Assessment Contract — canonical public decision and explainability wire types.
 * Assessment is the sole authority for posture and presentation intensity on the wire.
 */

export type AssessmentPosture = (typeof ASSESSMENT_POSTURES)[number];

export type AssessmentConfidence = (typeof ASSESSMENT_CONFIDENCES)[number];

export type ChangeClass = (typeof CHANGE_CLASSES)[number];

export type MergeConcernKind = (typeof MERGE_CONCERN_KINDS)[number];

export type NarrativeIntensity = (typeof NARRATIVE_INTENSITIES)[number];

export type ReachVisibility = (typeof REACH_VISIBILITIES)[number];

export type VerificationIntensity = (typeof VERIFICATION_INTENSITIES)[number];

export type InsightEmissionFloor = (typeof INSIGHT_EMISSION_FLOORS)[number];

export type AssessmentReportMode = (typeof ASSESSMENT_REPORT_MODES)[number];

export type ReviewEpisodeShape = (typeof REVIEW_EPISODE_SHAPES)[number];

export type FocalElectionDimension = (typeof FOCAL_ELECTION_DIMENSIONS)[number];

export type ReachBucket = (typeof REACH_BUCKETS)[number];

export type DeltaDimensionKind = (typeof DELTA_DIMENSION_KINDS)[number];

export type AssessmentConcern = {
  kind: MergeConcernKind;
  rank: number;
  packages?: string[];
  evidenceRefs: string[];
  /** One sentence of repository-specific context; absent when no repo-specific content. */
  context?: string;
};

export type AssessmentPresentation = {
  narrativeIntensity: NarrativeIntensity;
  reachVisibility: ReachVisibility;
  verificationIntensity: VerificationIntensity;
  insightEmissionFloor: InsightEmissionFloor;
  reportMode: AssessmentReportMode;
};

export type FocalElectionGrounding = {
  packageName: string;
  reason: string;
  decidedBy: FocalElectionDimension;
  evidenceRefs: string[];
};

export type FocalElectionExclusion = {
  packageName: string;
  reason: string;
  lostOn: FocalElectionDimension;
  evidenceRefs: string[];
};

export type ReviewFocalPoint = {
  episodeShape: ReviewEpisodeShape;
  anchors: string[];
  supportingPackages?: string[];
  election: {
    grounding: FocalElectionGrounding[];
    exclusions: FocalElectionExclusion[];
  };
  /** One sentence explaining the anchor election; absent for structural episodes or uncontested elections. */
  electionSummary?: string;
};

export type ReachScope = {
  packages: string[];
  maxBucket: ReachBucket;
  /** Repository entry paths grounded by propagation evidence (Phase 3.5). */
  entryPointFiles?: string[];
};

export type VerificationScope = {
  packages: string[];
  focus: string[];
  /** Actionable verification sentences; absent when verificationIntensity === 'none'. */
  guidance?: string[];
  /** Advisory artifact-grounded verification (tooling packages only). */
  artifactGrounded?: ArtifactGroundedVerificationScope;
};

export type ArtifactGroundedVerificationScope = {
  packages: string[];
  focus: string[];
  artifactPaths: string[];
};

/** Assessment wire contract (ABI 4 — adds outcome model fields; ABI 3 expression fields preserved). */
export type Assessment = {
  reviewFocalPoint: ReviewFocalPoint;
  reachScope: ReachScope;
  verificationScope: VerificationScope;
  posture: AssessmentPosture;
  confidence: AssessmentConfidence;
  primaryConcern: MergeConcernKind | null;
  concerns: AssessmentConcern[];
  factors: string[];
  changeClasses: ChangeClass[];
  presentation: AssessmentPresentation;
  /** Repository-specific reasoning sentences explaining this posture. Always produced. */
  reasoning: string[];
  /** One sentence explaining this confidence level. Always produced. */
  confidenceRationale: string;
  /**
   * Q8 answer: "What is not affected?" — authored for `cleared` outcome when at least one
   * dimension was proven unused. Detail/CLI only; absent when nothing was proven unused.
   */
  notAffectedLine?: string | null;
  /**
   * Q9 answer: "What would make this deterministic?" — authored in Expression for
   * `bounded_verify` and `abstain` outcomes. Absent for `cleared` and `proven_broken`.
   */
  resolutionLine?: string | null;
  // --- ABI 4 outcome model additions (optional; populated in Stage 7 shadow mode) ---
  /** Primary product outcome surface (ABI 4). Absent until shadow mode is active. */
  outcome?: AssessmentOutcome;
  perPackageOutcome?: Record<string, PackageOutcome>;
  clearanceEnvelopes?: Record<string, ClearanceEnvelope>;
  /** Bounded verify targets, capped at 3 per PR. */
  boundedVerifyTargets?: BoundedVerifyTarget[];
  evidenceSufficiencyVerdict?: EvidenceSufficiencyVerdict;
  abstainReasons?: AbstainReason[];
};

/** Wire presentation subset — excludes engine policy fields. */
export type AssessmentPresentationPublic = Pick<
  AssessmentPresentation,
  | "narrativeIntensity"
  | "reachVisibility"
  | "verificationIntensity"
  | "reportMode"
>;

export type AssessmentPresentationWire = AssessmentPresentation;

// --- ABI 4 outcome model types ---

export type AssessmentOutcome = (typeof ASSESSMENT_OUTCOMES)[number];

export type AbstainReasonKind = (typeof ABSTAIN_REASON_KINDS)[number];

export type SufficiencyBlockerKind = (typeof SUFFICIENCY_BLOCKER_KINDS)[number];

export type BoundedVerifyTargetKind =
  (typeof BOUNDED_VERIFY_TARGET_KINDS)[number];

export type ClearanceBasis = (typeof CLEARANCE_BASES)[number];

export type UnclearedReason = (typeof UNCLEARED_REASONS)[number];

export type CoverageClass = (typeof COVERAGE_CLASSES)[number];

export type AbstainReason = {
  kind: AbstainReasonKind;
  packageName?: string;
  detail?: string;
};

export type SufficiencyBlocker = {
  kind: SufficiencyBlockerKind;
  packageName?: string;
  detail?: string;
};

export type PackageSufficiency = {
  packageName: string;
  clearanceEligible: boolean;
  provenBrokenEligible: boolean;
  blockers: SufficiencyBlocker[];
};

export type EvidenceSufficiencyVerdict = {
  sufficient: boolean;
  clearanceEligible: boolean;
  provenBrokenEligible: boolean;
  boundedVerifyEligible: boolean;
  blockers: SufficiencyBlocker[];
  perPackage: Record<string, PackageSufficiency>;
};

export type BoundedVerifyTarget = {
  targetId: string;
  packageName: string;
  kind: BoundedVerifyTargetKind;
  file?: string;
  line?: number;
  configKey?: string;
  /**
   * Internal engine metadata identifying the scenario type.
   * NEVER rendered directly in developer-facing output — vocabulary firewall.
   * Expression uses `whatToVerify` (noun phrase) to compose the developer sentence.
   */
  scenario?: string;
  /**
   * Noun phrase describing the subject of verification.
   * Expression's BOUNDED_VERIFY_SENTENCE templates compose the full developer sentence.
   *
   * Correct:   "constraint ranges for `pkg-a`"
   * Incorrect: "Verify `pkg-a` constraint ranges are satisfied." (complete sentence — causes double-verb)
   */
  whatToVerify: string;
  whyAutomationStopped: string;
  /**
   * Internal proof-kind slug identifying what evidence would close this target.
   * NEVER rendered directly — Expression maps this to resolutionLine prose.
   */
  whatProofWouldResolveIt: string;
};

export type ClearedDimension = {
  kind: DeltaDimensionKind;
  basis: ClearanceBasis;
  proofArtifactRef?: string;
  noImpactProofRef?: string;
};

export type UnclearedDimension = {
  kind: DeltaDimensionKind;
  reason: UnclearedReason;
  boundedVerifyTarget?: BoundedVerifyTarget;
};

export type ClearanceEnvelope = {
  packageName: string;
  clearedDimensions: ClearedDimension[];
  unclearedDimensions: UnclearedDimension[];
  coverageClass: CoverageClass;
};

export type PackageOutcome = {
  packageName: string;
  outcome: AssessmentOutcome;
  proofArtifactRefs?: string[];
  clearanceEnvelopeRef?: string;
  boundedVerifyTargetRefs?: string[];
};
