import { z } from "zod";
import type { EngineEmittedScanResult, ScanResult } from "./types.js";

/** Bump when persisted `result` JSON validation rules change materially (relaxed / legacy-tolerant). */
export const SCAN_RESULT_ABI = "1" as const;

/** Bump when strict fresh-engine-output validation rules change materially. */
export const ENGINE_OUTPUT_SCAN_ABI = "1" as const;

const layerScoresSchema = z.object({
  security: z.number(),
  maintainability: z.number(),
  ecosystem: z.number(),
  upgradeImpact: z.number(),
});

/**
 * Minimum structural invariants for **persisted** `scans.result` JSON and legacy reads.
 * `methodologyVersion` stays optional so historical rows without it remain valid.
 * Unknown top-level keys are preserved (forward-compatible with newer engines).
 */
export const scanResultSchema = z
  .object({
    totalScore: z.number().min(0).max(100),
    layerScores: layerScoresSchema,
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
    decision: z
      .object({
        recommendation: z.enum(["safe", "needs_review", "risky"]),
        confidence: z.enum(["low", "medium", "high"]).optional(),
        reasoning: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
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

/**
 * Stricter schema for **fresh** `analyze()` output only. Do not use when hydrating
 * historical `scans.result` blobs from the database.
 */
export const engineOutputScanResultSchema = scanResultSchema.extend({
  methodologyVersion: z.string().trim().min(1),
  generatedAt: engineOutputGeneratedAtSchema,
});

export type EngineOutputScanResultParseFailure = {
  ok: false;
  message: string;
  issues: string[];
};

export type EngineOutputScanResultParseSuccess = {
  ok: true;
  result: EngineEmittedScanResult;
};

export function safeParseEngineOutputScanResult(
  data: unknown,
): EngineOutputScanResultParseSuccess | EngineOutputScanResultParseFailure {
  const parsed = engineOutputScanResultSchema.safeParse(data);
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
): EngineEmittedScanResult {
  const r = safeParseEngineOutputScanResult(data);
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
