import { z } from "zod";

import {
  ASSESSMENT_POSTURES,
  MERGE_CONCERN_KINDS,
  NARRATIVE_INTENSITIES,
  REACH_VISIBILITIES,
} from "../../assessment/literals.js";
import type { ScanDetailsPresentation } from "./scanDetailsPresentation.js";

const verificationChannelSchema = z.enum(["runtime", "artifact", "none"]);

const scoreLayerSchema = z.enum([
  "security",
  "maintainability",
  "ecosystem",
  "upgradeImpact",
]);

const findingSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

const presentationStatusSchema = z.enum([
  "safe",
  "needs_review",
  "risky",
  "indeterminate",
]);

const presentationDensitySchema = z.enum(["minimal", "standard", "rich"]);

const presentationConfidenceSchema = z.enum(["high", "medium", "low"]);

const presentationPrioritySchema = z.enum(["pr_intelligence", "limited"]);

const presentationIntentSchema = z.enum([
  "limited_context",
  "no_changed_packages",
  "tooling_patch",
  "tooling_upgrade",
  "runtime_upgrade",
  "auth_runtime_upgrade",
  "queue_runtime_upgrade",
  "multi_runtime_upgrade",
  "unknown_upgrade",
]);

const assessmentPresentationFieldsSchema = z
  .object({
    posture: z.enum(ASSESSMENT_POSTURES),
    primaryConcern: z.enum(MERGE_CONCERN_KINDS).nullable(),
    factors: z.array(z.string()),
    reasoning: z.array(z.string()),
    verificationFocus: z.array(z.string()),
    verificationChannel: verificationChannelSchema,
    reachVisibility: z.enum(REACH_VISIBILITIES),
    narrativeIntensity: z.enum(NARRATIVE_INTENSITIES),
    confidenceRationale: z.string().optional(),
    electionSummary: z.string().optional(),
  })
  .strict();

const presentationEvidenceContextSchema = z
  .object({
    priority: presentationPrioritySchema,
    degradedMessage: z.string().optional(),
  })
  .strict();

const scanDetailsHeroSchema = z
  .object({
    headline: z.string(),
    subheadline: z.string().optional(),
    verdictLine: z.string(),
    scopeChip: z.string().optional(),
    postureLabel: z.string(),
    prRiskScore: z.number().nullable().optional(),
    prRiskBandLabel: z.string().optional(),
    riskIndex: z.number().nullable().optional(),
  })
  .strict();

const scanDetailsNarrativeSchema = z
  .object({
    keyPoints: z.array(z.string()),
    changedPackages: z.array(z.string()),
    primaryPackage: z.string().optional(),
  })
  .strict();

const scanDetailsUsageSchema = z
  .object({
    summary: z.string().optional(),
    items: z.array(
      z
        .object({
          packageName: z.string(),
          paths: z.array(z.string()),
          areas: z.array(z.string()),
          criticalPaths: z.array(z.string()).optional(),
        })
        .strict(),
    ),
    frameworks: z.array(z.string()),
  })
  .strict();

const scanDetailsVerificationSchema = z
  .object({
    actions: z.array(
      z
        .object({
          title: z.string(),
          detail: z.string().optional(),
          affectedFiles: z.array(z.string()).optional(),
        })
        .strict(),
    ),
  })
  .strict();

const signalSummaryLayerSchema = z
  .object({
    layer: scoreLayerSchema,
    score: z.number(),
    band: z.enum(["low", "medium", "high"]),
    label: z.string(),
  })
  .strict();

const signalSummarySchema = z
  .object({
    prRiskScore: z.number(),
    band: z.enum(["low", "medium", "high"]),
    layers: z.array(signalSummaryLayerSchema),
  })
  .strict();

const operationalImpactSchema = z
  .object({
    status: z.enum(["rich", "compact", "hidden"]),
    items: z.array(
      z
        .object({
          message: z.string(),
          where: z.string().optional(),
          verify: z.string().optional(),
          affectedFiles: z.array(z.string()).optional(),
        })
        .strict(),
    ),
    fallbackMessage: z.string().optional(),
  })
  .strict();

const recommendationItemSchema = z
  .object({
    rank: z.number(),
    title: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    rationale: z.string().optional(),
  })
  .strict();

const recommendationsSchema = z
  .object({
    items: z.array(recommendationItemSchema),
  })
  .strict();

const evidencePackageSchema = z
  .object({
    name: z.string(),
    version: z.string().optional(),
    direct: z.boolean(),
    severity: findingSeveritySchema.optional(),
    evidence: z.string().optional(),
  })
  .strict();

const attentionAreaSchema = z
  .object({
    problemLabel: z.string(),
    problemDescription: z.string(),
    packages: z.array(evidencePackageSchema),
    overflowCount: z.number().int().nonnegative(),
  })
  .strict();

const evidenceFindingSchema = z
  .object({
    id: z.string(),
    severity: findingSeveritySchema,
    title: z.string(),
    description: z.string(),
    packageName: z.string(),
    recommendation: z.string().optional(),
    source: z.enum(["dependency", "code"]),
  })
  .strict();

const evidenceTopologySchema = z
  .object({
    summaryLine: z.string(),
    deepest: z.array(
      z
        .object({
          packageName: z.string(),
          depth: z.number().int(),
          direct: z.boolean(),
          via: z.array(z.string()),
        })
        .strict(),
    ),
  })
  .strict();

const scanDetailsEvidenceSchema = z
  .object({
    defaultCollapsed: z.boolean(),
    attentionAreas: z.array(attentionAreaSchema),
    findings: z.array(evidenceFindingSchema),
    findingsOverflowCount: z.number().int().nonnegative(),
    topology: evidenceTopologySchema.optional(),
  })
  .strict();

const supportingContextSchema = z
  .object({
    title: z.string(),
    lines: z.array(z.string()),
  })
  .strict();

const scanDetailsMetadataSchema = z
  .object({
    scanId: z.string().min(1),
    generatedAt: z.string().optional(),
    methodologyVersion: z.string().nullable().optional(),
    changedPackagesSummary: z.string().optional(),
  })
  .strict();

/** Runtime wire schema for {@link ScanDetailsPresentation}. */
export const scanDetailsPresentationSchema: z.ZodType<ScanDetailsPresentation> =
  assessmentPresentationFieldsSchema
    .extend({
      resolutionLine: z.string().nullable(),
      notAffectedLine: z.string().nullable(),
      evidenceContext: presentationEvidenceContextSchema,
      status: presentationStatusSchema,
      density: presentationDensitySchema,
      confidence: presentationConfidenceSchema,
      hero: scanDetailsHeroSchema,
      narrative: scanDetailsNarrativeSchema,
      usage: scanDetailsUsageSchema.optional(),
      verification: scanDetailsVerificationSchema,
      signalSummary: signalSummarySchema.optional(),
      operationalImpact: operationalImpactSchema,
      recommendations: recommendationsSchema,
      evidence: scanDetailsEvidenceSchema,
      supportingContext: supportingContextSchema.optional(),
      metadata: scanDetailsMetadataSchema,
      presentationIntent: presentationIntentSchema.optional(),
    })
    .strict();

export function parseScanDetailsPresentation(
  input: unknown,
): ScanDetailsPresentation {
  return scanDetailsPresentationSchema.parse(input);
}

export function safeParseScanDetailsPresentation(input: unknown) {
  return scanDetailsPresentationSchema.safeParse(input);
}
