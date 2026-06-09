/**
 * Assessment Contract — mirrored from mergesignal-engine/packages/analysis-engine/src/assessment/types.ts
 * Bump {@link ASSESSMENT_ABI} when this schema changes incompatibly.
 */
import { z } from "zod";

export const ASSESSMENT_ABI = "1" as const;

export const ASSESSMENT_POSTURES = ["safe", "needs_review", "risky"] as const;
export type AssessmentPosture = (typeof ASSESSMENT_POSTURES)[number];

export const ASSESSMENT_CONFIDENCES = ["low", "medium", "high"] as const;
export type AssessmentConfidence = (typeof ASSESSMENT_CONFIDENCES)[number];

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
export type ChangeClass = (typeof CHANGE_CLASSES)[number];

export const MERGE_CONCERN_KINDS = [
  "confirmed_runtime_usage",
  "security_finding",
  "breaking_or_major",
  "behavioral_change",
  "ecosystem_risk",
  "insufficient_evidence",
  "graph_baseline_only",
] as const;
export type MergeConcernKind = (typeof MERGE_CONCERN_KINDS)[number];

export const NARRATIVE_INTENSITIES = [
  "minimal",
  "standard",
  "elevated",
] as const;
export type NarrativeIntensity = (typeof NARRATIVE_INTENSITIES)[number];

export const REACH_VISIBILITIES = [
  "hidden",
  "contextual",
  "prominent",
] as const;
export type ReachVisibility = (typeof REACH_VISIBILITIES)[number];

export const VERIFICATION_INTENSITIES = [
  "none",
  "advisory",
  "required",
] as const;
export type VerificationIntensity = (typeof VERIFICATION_INTENSITIES)[number];

export const INSIGHT_EMISSION_FLOORS = [
  "none",
  "explain_only",
  "full",
] as const;
export type InsightEmissionFloor = (typeof INSIGHT_EMISSION_FLOORS)[number];

export const ASSESSMENT_REPORT_MODES = [
  "lightweight_pr_graph_baseline",
  "high_signal_pr",
] as const;
export type AssessmentReportMode = (typeof ASSESSMENT_REPORT_MODES)[number];

const assessmentConcernSchema = z.object({
  kind: z.enum(MERGE_CONCERN_KINDS),
  rank: z.number().int().nonnegative(),
  packages: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()),
});

const assessmentPresentationWireSchema = z.object({
  narrativeIntensity: z.enum(NARRATIVE_INTENSITIES),
  reachVisibility: z.enum(REACH_VISIBILITIES),
  verificationIntensity: z.enum(VERIFICATION_INTENSITIES),
  insightEmissionFloor: z.enum(INSIGHT_EMISSION_FLOORS),
  reportMode: z.enum(ASSESSMENT_REPORT_MODES),
});

export const assessmentSchema = z.object({
  posture: z.enum(ASSESSMENT_POSTURES),
  confidence: z.enum(ASSESSMENT_CONFIDENCES),
  primaryConcern: z.enum(MERGE_CONCERN_KINDS).nullable(),
  concerns: z.array(assessmentConcernSchema),
  factors: z.array(z.string()),
  changeClasses: z.array(z.enum(CHANGE_CLASSES)),
  presentation: assessmentPresentationWireSchema,
});

export type AssessmentConcern = z.infer<typeof assessmentConcernSchema>;
export type AssessmentPresentationWire = z.infer<
  typeof assessmentPresentationWireSchema
>;

/** Public presentation subset — excludes engine policy fields. */
export type AssessmentPresentationPublic = Pick<
  AssessmentPresentationWire,
  | "narrativeIntensity"
  | "reachVisibility"
  | "verificationIntensity"
  | "reportMode"
>;

export type Assessment = z.infer<typeof assessmentSchema>;

export function toPublicPresentation(
  wire: AssessmentPresentationWire,
): AssessmentPresentationPublic {
  return {
    narrativeIntensity: wire.narrativeIntensity,
    reachVisibility: wire.reachVisibility,
    verificationIntensity: wire.verificationIntensity,
    reportMode: wire.reportMode,
  };
}

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

export function safeParseAssessment(
  data: unknown,
): { ok: true; value: Assessment } | { ok: false; issues: string[] } {
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

/** Map engine narrative intensity to presentation density (formatting only). */
export function narrativeIntensityToDensity(
  intensity: NarrativeIntensity,
): "minimal" | "standard" | "rich" {
  if (intensity === "minimal") return "minimal";
  if (intensity === "elevated") return "rich";
  return "standard";
}
