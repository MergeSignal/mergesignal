import { z } from "zod";

import { scanDetailsPresentationSchema } from "./presentation/dto/scanDetailsPresentationSchema.js";
import type { AnalysisContextWarningCode } from "./types.js";
import {
  REPOSITORY_EVIDENCE_SCHEMA_VERSION,
  type GovernedScanProductResponse,
  type RepositoryEvidenceEnvelope,
  type SerializableScanAcquiredFacts,
  SCAN_OPERATIONAL_OUTCOME_KINDS,
} from "./scanIngressWire.js";

const analysisContextWarningCodeSchema = z.enum([
  "lockfile_diff_skipped",
  "lockfile_diff_failed",
  "lockfile_evidence_incomplete",
  "lockfile_head_missing",
  "base_lockfile_missing",
  "code_fetch_skipped",
  "code_fetch_failed",
  "code_fetch_auth_failure",
  "code_fetch_timeout",
  "code_fetch_rate_limit",
  "code_corpus_empty",
  "repo_intelligence_contract_invalid",
  "package_change_ingress_rejected",
  "package_change_code_analysis_dropped",
  "package_change_ambiguous_transition",
] satisfies [AnalysisContextWarningCode, ...AnalysisContextWarningCode[]]);

const lockfileManagerSchema = z.enum(["pnpm", "npm", "yarn"]);

export const scanLockfileInputSchema = z.object({
  manager: lockfileManagerSchema,
  content: z.string(),
  path: z.string().optional(),
});

export const scanRevisionRefSchema = z.object({
  ref: z.string().optional(),
  sha: z.string().min(1),
});

export const scanChangeIntentSchema = z.enum([
  "change_request",
  "repository_scope",
]);

export const analysisContextWarningSchema = z.object({
  code: analysisContextWarningCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const repositoryCorpusAcquisitionSummarySchema = z
  .object({
    filesIncluded: z.number().int().nonnegative(),
    filesSkippedPolicy: z.number().int().nonnegative(),
    filesSkippedSize: z.number().int().nonnegative(),
    filesSkippedBinary: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    truncated: z.boolean(),
    corpusIgnorePolicyPartial: z.boolean().optional(),
  })
  .strict();

export const serializableScanAcquiredFactsSchema = z
  .object({
    repoId: z.string().min(1).max(500),
    changeIntent: scanChangeIntentSchema,
    headRevision: scanRevisionRefSchema,
    baseRevision: scanRevisionRefSchema.optional(),
    lockfileAtHead: scanLockfileInputSchema.optional(),
    lockfileAtBase: scanLockfileInputSchema.optional(),
    changedPaths: z.array(z.string()).optional(),
    changedManifestPaths: z.array(z.string()).optional(),
    dependencyGraph: z.unknown().optional(),
    acquisitionWarnings: z.array(analysisContextWarningSchema).optional(),
  })
  .strict();

export const repositoryEvidenceEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(REPOSITORY_EVIDENCE_SCHEMA_VERSION),
    files: z.record(z.string(), z.string()),
    reportedAcquisitionSummary: repositoryCorpusAcquisitionSummarySchema,
  })
  .strict();

const scanOperationalOutcomeSchema = z
  .object({
    kind: z.enum(SCAN_OPERATIONAL_OUTCOME_KINDS),
    scanId: z.string().min(1),
    repoId: z.string().min(1),
    explanationCode: z.string().min(1),
    message: z.string(),
    warnings: z.array(analysisContextWarningSchema).optional(),
  })
  .strict();

const ASSESSMENT_AUTHORITY_KEYS = [
  "posture",
  "primaryConcern",
  "assessment",
  "decision",
  "recommendation",
  "confidence",
] as const;

const governedScanProductResponseSchema: z.ZodType<GovernedScanProductResponse> =
  z.discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("operational"),
        outcome: scanOperationalOutcomeSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("analysis_complete"),
        scanId: z.string().min(1),
        detailPresentation: scanDetailsPresentationSchema,
      })
      .strict(),
  ]);

export function parseSerializableScanAcquiredFacts(
  input: unknown,
): SerializableScanAcquiredFacts {
  return serializableScanAcquiredFactsSchema.parse(input);
}

export function safeParseSerializableScanAcquiredFacts(input: unknown) {
  return serializableScanAcquiredFactsSchema.safeParse(input);
}

export function parseRepositoryEvidenceEnvelope(
  input: unknown,
): RepositoryEvidenceEnvelope {
  return repositoryEvidenceEnvelopeSchema.parse(input);
}

export function safeParseRepositoryEvidenceEnvelope(input: unknown) {
  return repositoryEvidenceEnvelopeSchema.safeParse(input);
}

export function parseGovernedScanProductResponse(
  input: unknown,
): GovernedScanProductResponse {
  const parsed = governedScanProductResponseSchema.parse(input);
  if (parsed.kind === "operational") {
    assertNoAssessmentAuthority(parsed.outcome, ["outcome"]);
  }
  return parsed;
}

export function safeParseGovernedScanProductResponse(input: unknown) {
  const result = governedScanProductResponseSchema.safeParse(input);
  if (!result.success) return result;
  try {
    return {
      success: true as const,
      data: parseGovernedScanProductResponse(result.data),
    };
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}

function assertNoAssessmentAuthority(
  value: Record<string, unknown>,
  pathPrefix: string[],
): void {
  for (const key of ASSESSMENT_AUTHORITY_KEYS) {
    if (key in value && value[key] !== undefined) {
      throw new Error(
        `Operational product contract must not include Assessment authority field \`${key}\` at ${pathPrefix.join(".")}`,
      );
    }
  }
}

const utf8ByteLength = new TextEncoder();

/** Recompute byte count from envelope files for server-side validation. */
export function computedEvidenceTotalBytes(
  files: Record<string, string>,
): number {
  let total = 0;
  for (const content of Object.values(files)) {
    total += utf8ByteLength.encode(content).length;
  }
  return total;
}
