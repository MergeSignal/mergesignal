import { assessmentSchema } from "./assessment/schema.js";
import { z } from "zod";
import type { FreshEngineOutputExpectation } from "./scanAnalysisScope.js";
import type { EngineEmittedScanResult, ScanResult } from "./types.js";

/** Bump when persisted `result` JSON validation rules change materially (relaxed / legacy-tolerant). */
export const SCAN_RESULT_ABI = "2" as const;

/** Bump when strict fresh-engine-output validation rules change materially. */
export const ENGINE_OUTPUT_SCAN_ABI = "5" as const;

const layerScoresSchema = z.object({
  security: z.number(),
  maintainability: z.number(),
  ecosystem: z.number(),
  upgradeImpact: z.number(),
});

const prRiskScoredSchema = z.object({
  availability: z.literal("scored").optional(),
  score: z.number().min(0).max(100),
  layerScores: layerScoresSchema.optional(),
  qualifier: z.literal("limited_evidence").optional(),
});

const prRiskIndeterminateSchema = z.object({
  availability: z.literal("indeterminate"),
  qualifier: z.literal("limited_evidence").optional(),
});

const prRiskSchema = z.union([prRiskScoredSchema, prRiskIndeterminateSchema]);

const explainReasonSchema = z.object({
  id: z.string(),
  layer: z.enum(["security", "maintainability", "ecosystem", "upgradeImpact"]),
  title: z.string(),
  value: z.number().optional(),
  scoreImpact: z.number(),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

const explainBlockSchema = z.object({
  reasons: z.array(explainReasonSchema),
});

const scoreContributionSchema = z.object({
  id: z.string(),
  layer: z.enum(["security", "maintainability", "ecosystem", "upgradeImpact"]),
  scoreImpact: z.number(),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

const repositoryHealthSchema = z.object({
  totalScore: z.number().min(0).max(100),
  layerScores: layerScoresSchema.optional(),
  explain: explainBlockSchema.optional(),
  topContributions: z.array(scoreContributionSchema).optional(),
});

const decisionSchema = z
  .object({
    recommendation: z.enum(["safe", "needs_review", "risky", "indeterminate"]),
    confidence: z.enum(["low", "medium", "high"]).optional(),
    reasoning: z.array(z.string()).optional(),
  })
  .passthrough();

const MODERN_PR_FORBIDDEN_ROOT_KEYS = [
  "totalScore",
  "layerScores",
  "signals",
  "contributions",
  "explain",
] as const;

function refineChangeRequestForbiddenRoots(
  obj: Record<string, unknown>,
  ctx: z.RefinementCtx,
): void {
  if (obj.prRisk === undefined) {
    return;
  }
  for (const key of MODERN_PR_FORBIDDEN_ROOT_KEYS) {
    if (obj[key] !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Change-request engine output must not emit root \`${key}\``,
        path: [key],
      });
    }
  }
  if (obj.assessment !== undefined && obj.confidence !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Change-request engine output must not emit root `confidence` when assessment is present",
      path: ["confidence"],
    });
  }
}

function refineRepositoryForbiddenPrAuthorities(
  obj: Record<string, unknown>,
  ctx: z.RefinementCtx,
): void {
  if (obj.prRisk !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Repository-scoped engine output must not emit `prRisk`",
      path: ["prRisk"],
    });
  }
  if (obj.repositoryHealth !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Repository-scoped engine output must not emit `repositoryHealth`",
      path: ["repositoryHealth"],
    });
  }
}

/** @deprecated Use refineChangeRequestForbiddenRoots — kept for transitional reads. */
function refineModernPrForbiddenRoots(
  obj: Record<string, unknown>,
  ctx: z.RefinementCtx,
): void {
  refineChangeRequestForbiddenRoots(obj, ctx);
}

/**
 * Legacy ingest helper only. Synthesizes repositoryHealth from legacy root graph
 * scores when repositoryHealth is missing. Never synthesizes prRisk.
 *
 * Not invoked by strict fresh engine-output validation (`safeParseEngineOutputScanResult`).
 */
export function normalizeEngineOutputAbi4(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const totalScore = obj.totalScore;
  const layerScores = obj.layerScores;
  if (typeof totalScore !== "number" || !Number.isFinite(totalScore)) {
    return raw;
  }
  if (!layerScores || typeof layerScores !== "object") return raw;
  return {
    ...obj,
    repositoryHealth: obj.repositoryHealth ?? { totalScore, layerScores },
  };
}

/**
 * Minimum structural invariants for **persisted** `scans.result` JSON and legacy reads.
 * `methodologyVersion` stays optional so historical rows without it remain valid.
 * Unknown top-level keys are preserved (forward-compatible with newer engines).
 */
export const scanResultSchema = z
  .object({
    totalScore: z.number().min(0).max(100).optional(),
    layerScores: layerScoresSchema.optional(),
    prRisk: prRiskSchema.optional(),
    repositoryHealth: repositoryHealthSchema.optional(),
    findings: z
      .union([z.array(z.unknown()), z.null()])
      .optional()
      .transform((v) => (Array.isArray(v) ? v : [])),
    methodologyVersion: z.string().optional(),
    confidence: z.enum(["low", "medium", "high"]).optional(),
    signals: z.array(z.unknown()).optional(),
    contributions: z.array(z.unknown()).optional(),
    recommendations: z.array(z.unknown()).optional(),
    dataset: z.unknown().optional(),
    explain: z.unknown().optional(),
    graphInsights: z.unknown().optional(),
    generatedAt: z.string().min(1),
    insights: z.array(z.unknown()).optional(),
    decision: decisionSchema.optional(),
    codeAnalysisMetrics: z.unknown().optional(),
  })
  .passthrough();

const engineOutputGeneratedAtSchema = z
  .string()
  .trim()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    error: "generatedAt must be a parseable ISO-8601 timestamp",
  });

const freshEngineOutputBaseSchema = scanResultSchema.extend({
  methodologyVersion: z.string().trim().min(1),
  generatedAt: engineOutputGeneratedAtSchema,
});

/** Strict schema for fresh change-request `analyze()` output. */
const changeRequestEngineOutputScanResultSchema = freshEngineOutputBaseSchema
  .extend({
    assessment: assessmentSchema,
    decision: decisionSchema,
    prRisk: prRiskSchema,
    repositoryHealth: repositoryHealthSchema,
  })
  .superRefine((obj, ctx) => {
    refineChangeRequestForbiddenRoots(obj as Record<string, unknown>, ctx);
  });

/** Strict schema for fresh repository-scoped `analyze()` output. */
export const repositoryEngineOutputScanResultSchema =
  freshEngineOutputBaseSchema
    .extend({
      totalScore: z.number().min(0).max(100),
      layerScores: layerScoresSchema,
    })
    .superRefine((obj, ctx) => {
      refineRepositoryForbiddenPrAuthorities(
        obj as Record<string, unknown>,
        ctx,
      );
    });

/**
 * Stricter schema for **fresh** `analyze()` output only. Do not use when hydrating
 * historical `scans.result` blobs from the database.
 *
 * Prefer {@link engineOutputScanResultSchemaFor} with an explicit analysis-scope expectation.
 */
export const engineOutputScanResultSchema =
  changeRequestEngineOutputScanResultSchema;

export type EngineOutputScanResultParseFailure = {
  ok: false;
  message: string;
  issues: string[];
};

export type EngineOutputScanResultParseSuccess = {
  ok: true;
  result: EngineEmittedScanResult;
};

export function engineOutputScanResultSchemaFor(
  expectation: FreshEngineOutputExpectation,
): z.ZodType {
  return expectation === "change_request"
    ? changeRequestEngineOutputScanResultSchema
    : repositoryEngineOutputScanResultSchema;
}

export function safeParseEngineOutputScanResult(
  data: unknown,
  expectation: FreshEngineOutputExpectation,
): EngineOutputScanResultParseSuccess | EngineOutputScanResultParseFailure {
  const parsed = engineOutputScanResultSchemaFor(expectation).safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    return {
      ok: false,
      message: issues.join("; "),
      issues,
    };
  }
  return { ok: true, result: parsed.data as EngineEmittedScanResult };
}

/** Validates fresh engine output; throws on failure. Not for legacy persisted JSON. */
export function parseEngineOutputScanResultOrThrow(
  data: unknown,
  expectation: FreshEngineOutputExpectation,
): EngineEmittedScanResult {
  const r = safeParseEngineOutputScanResult(data, expectation);
  if (!r.ok) {
    throw new Error(`validation: ${r.message}`);
  }
  return r.result;
}

export type ScanResultParseFailure = {
  ok: false;
  message: string;
  issues: string[];
};

export type ScanResultParseSuccess = {
  ok: true;
  result: ScanResult;
};

export function safeParseScanResult(
  data: unknown,
): ScanResultParseSuccess | ScanResultParseFailure {
  const parsed = scanResultSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    return {
      ok: false,
      message: issues.join("; "),
      issues,
    };
  }
  return { ok: true, result: parsed.data as ScanResult };
}

/** Validates engine output at the worker boundary; throws on failure. */
export function parseScanResultOrThrow(data: unknown): ScanResult {
  const r = safeParseScanResult(data);
  if (!r.ok) {
    throw new Error(`validation: ${r.message}`);
  }
  return r.result;
}
