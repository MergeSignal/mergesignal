import { z } from "zod";

import {
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
import type { Assessment } from "./types.js";

const assessmentConcernSchema = z.object({
  kind: z.enum(MERGE_CONCERN_KINDS),
  rank: z.number().int().nonnegative(),
  packages: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()),
  context: z.string().optional(),
});

const assessmentPresentationWireSchema = z.object({
  narrativeIntensity: z.enum(NARRATIVE_INTENSITIES),
  reachVisibility: z.enum(REACH_VISIBILITIES),
  verificationIntensity: z.enum(VERIFICATION_INTENSITIES),
  insightEmissionFloor: z.enum(INSIGHT_EMISSION_FLOORS),
  reportMode: z.enum(ASSESSMENT_REPORT_MODES),
});

const reviewFocalPointSchema = z.object({
  episodeShape: z.enum(REVIEW_EPISODE_SHAPES),
  anchors: z.array(z.string()),
  supportingPackages: z.array(z.string()).optional(),
  election: z.object({
    grounding: z.array(
      z.object({
        packageName: z.string(),
        reason: z.string(),
        decidedBy: z.enum(FOCAL_ELECTION_DIMENSIONS),
        evidenceRefs: z.array(z.string()),
      }),
    ),
    exclusions: z.array(
      z.object({
        packageName: z.string(),
        reason: z.string(),
        lostOn: z.enum(FOCAL_ELECTION_DIMENSIONS),
        evidenceRefs: z.array(z.string()),
      }),
    ),
  }),
  electionSummary: z.string().optional(),
});

const reachScopeSchema = z.object({
  packages: z.array(z.string()),
  maxBucket: z.enum(REACH_BUCKETS),
  entryPointFiles: z.array(z.string()).optional(),
});

const artifactGroundedVerificationScopeSchema = z.object({
  packages: z.array(z.string()),
  focus: z.array(z.string()),
  artifactPaths: z.array(z.string()),
});

const verificationScopeSchema = z.object({
  packages: z.array(z.string()),
  focus: z.array(z.string()),
  guidance: z.array(z.string()).optional(),
  artifactGrounded: artifactGroundedVerificationScopeSchema.optional(),
});

// --- ABI 4 outcome model sub-schemas ---

const abstainReasonSchema = z.object({
  kind: z.enum(ABSTAIN_REASON_KINDS),
  packageName: z.string().optional(),
  detail: z.string().optional(),
});

const sufficiencyBlockerSchema = z.object({
  kind: z.enum(SUFFICIENCY_BLOCKER_KINDS),
  packageName: z.string().optional(),
  detail: z.string().optional(),
});

const packageSufficiencySchema = z.object({
  packageName: z.string(),
  clearanceEligible: z.boolean(),
  provenBrokenEligible: z.boolean(),
  blockers: z.array(sufficiencyBlockerSchema),
});

const evidenceSufficiencyVerdictSchema = z.object({
  sufficient: z.boolean(),
  clearanceEligible: z.boolean(),
  provenBrokenEligible: z.boolean(),
  boundedVerifyEligible: z.boolean(),
  blockers: z.array(sufficiencyBlockerSchema),
  perPackage: z.record(z.string(), packageSufficiencySchema),
});

const boundedVerifyTargetSchema = z.object({
  targetId: z.string(),
  packageName: z.string(),
  kind: z.enum(BOUNDED_VERIFY_TARGET_KINDS),
  file: z.string().optional(),
  line: z.number().int().nonnegative().optional(),
  configKey: z.string().optional(),
  scenario: z.string().optional(),
  whatToVerify: z.string(),
  whyAutomationStopped: z.string(),
  whatProofWouldResolveIt: z.string(),
});

const clearedDimensionSchema = z.object({
  kind: z.enum(DELTA_DIMENSION_KINDS),
  basis: z.enum(CLEARANCE_BASES),
  proofArtifactRef: z.string().optional(),
  noImpactProofRef: z.string().optional(),
});

const unclearedDimensionSchema = z.object({
  kind: z.enum(DELTA_DIMENSION_KINDS),
  reason: z.enum(UNCLEARED_REASONS),
  boundedVerifyTarget: boundedVerifyTargetSchema.optional(),
});

const clearanceEnvelopeSchema = z.object({
  packageName: z.string(),
  clearedDimensions: z.array(clearedDimensionSchema),
  unclearedDimensions: z.array(unclearedDimensionSchema),
  coverageClass: z.enum(COVERAGE_CLASSES),
});

const packageOutcomeSchema = z.object({
  packageName: z.string(),
  outcome: z.enum(ASSESSMENT_OUTCOMES),
  proofArtifactRefs: z.array(z.string()).optional(),
  clearanceEnvelopeRef: z.string().optional(),
  boundedVerifyTargetRefs: z.array(z.string()).optional(),
});

/** Root Assessment wire schema (ABI 4).
 *
 * All ABI 3 required fields are preserved. ABI 4 outcome model fields are optional,
 * so ABI 3 payloads continue to parse successfully. Parsers must tolerate absent ABI 4
 * fields and treat them as "shadow mode not yet active."
 */
export const assessmentSchema = z.object({
  reviewFocalPoint: reviewFocalPointSchema,
  reachScope: reachScopeSchema,
  verificationScope: verificationScopeSchema,
  posture: z.enum(ASSESSMENT_POSTURES),
  confidence: z.enum(ASSESSMENT_CONFIDENCES),
  primaryConcern: z.enum(MERGE_CONCERN_KINDS).nullable(),
  concerns: z.array(assessmentConcernSchema),
  factors: z.array(z.string()),
  changeClasses: z.array(z.enum(CHANGE_CLASSES)),
  presentation: assessmentPresentationWireSchema,
  reasoning: z.array(z.string()),
  confidenceRationale: z.string(),
  notAffectedLine: z.string().nullable().optional(),
  resolutionLine: z.string().nullable().optional(),
  // ABI 4 optional outcome model fields — absent when shadow mode is inactive
  outcome: z.enum(ASSESSMENT_OUTCOMES).optional(),
  perPackageOutcome: z.record(z.string(), packageOutcomeSchema).optional(),
  clearanceEnvelopes: z.record(z.string(), clearanceEnvelopeSchema).optional(),
  boundedVerifyTargets: z.array(boundedVerifyTargetSchema).optional(),
  evidenceSufficiencyVerdict: evidenceSufficiencyVerdictSchema.optional(),
  abstainReasons: z.array(abstainReasonSchema).optional(),
});

export type SafeParseAssessmentResult =
  | { ok: true; value: Assessment }
  | { ok: false; issues: string[] };

export function parseAssessmentOrThrow(data: unknown): Assessment {
  const parsed = assessmentSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`assessment validation: ${issues}`);
  }
  return parsed.data;
}

export function safeParseAssessment(data: unknown): SafeParseAssessmentResult {
  const parsed = assessmentSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    };
  }
  return { ok: true, value: parsed.data };
}
