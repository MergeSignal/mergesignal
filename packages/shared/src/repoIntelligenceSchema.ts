/**
 * Canonical `ScanResult.repoIntelligence` wire contract (Wave 1 + Wave 2).
 *
 * Bump {@link REPO_INTELLIGENCE_ABI} when this schema changes incompatibly.
 * Engine maps internal signals to this shape at emit time; consumers must use
 * {@link safeParseRepoIntelligence} and honor `analysisPreparation.repoIntelligenceValidation`.
 */
import { z } from "zod";
import type { ScanResult } from "./types.js";
import type { BlastRadiusLevel } from "./scanNarrativeFacts.js";

/** Bump when wire schema changes incompatibly. */
export const REPO_INTELLIGENCE_ABI = "2" as const;

const surfaceKindSchema = z.enum(["runtime", "build", "test", "unknown"]);

const reachabilityKindSchema = z.enum([
  "on_runtime_paths",
  "build_only",
  "test_only",
  "unreachable",
  "unknown",
]);

const blastLevelSchema = z.enum(["narrow", "moderate", "wide"]);

const packageUsageWireSchema = z.object({
  packageName: z.string().min(1),
  files: z.array(z.string()),
  paths: z.array(z.string()).optional(),
  criticalPaths: z.array(z.string()).optional(),
  areas: z.array(z.string()).optional(),
});

const dependencyClassSchema = z.enum([
  "runtime",
  "tooling",
  "test",
  "lint",
  "format",
  "build",
  "ci",
  "unknown",
]);

const packageRoleSchema = z.enum([
  "typechecker",
  "compiler",
  "bundler",
  "linter",
  "formatter",
  "test_runner",
  "http_framework",
  "auth",
  "queue",
  "orm",
  "unknown",
]);

const lockfileKindSchema = z.enum([
  "production",
  "development",
  "optional",
  "unknown",
]);

const runtimeImpactSchema = z.enum([
  "none",
  "possible",
  "confirmed",
  "unknown",
]);

const expectedImpactSchema = z.enum([
  "runtime",
  "build_time",
  "typecheck",
  "test_time",
  "development_only",
  "unknown",
]);

const evidenceStrengthSchema = z.enum(["high", "medium", "low"]);

const classificationProvenanceSchema = z.object({
  dependencyClass: z.enum([
    "registry",
    "graph",
    "lockfile",
    "heuristic",
    "unknown",
  ]),
  packageRole: z.enum(["registry", "graph", "heuristic", "unknown"]),
  registryEntryId: z.string().optional(),
});

const semanticDiagnosticSchema = z.object({
  packageName: z.string().min(1),
  ruleId: z.string().min(1),
  before: z.record(z.string(), z.unknown()),
  after: z.record(z.string(), z.unknown()),
  reason: z.string().min(1),
});

const packageIntelWireSchema = z.object({
  runtimeSurface: surfaceKindSchema,
  reachability: reachabilityKindSchema,
  usage: packageUsageWireSchema,
  areas: z.array(z.string()).optional(),
  dependencyClass: dependencyClassSchema.optional(),
  packageRole: packageRoleSchema.optional(),
  lockfileKind: lockfileKindSchema.optional(),
  runtimeImpact: runtimeImpactSchema.optional(),
  expectedImpact: expectedImpactSchema.optional(),
  evidenceStrength: evidenceStrengthSchema.optional(),
  confidenceReason: z.string().optional(),
  verificationFocus: z.array(z.string()).optional(),
  suppressRuntimeNarrative: z.boolean().optional(),
  classificationProvenance: classificationProvenanceSchema.optional(),
});

const areaSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const hotspotWireSchema = z.object({
  packageName: z.string().min(1),
  source: z.enum(["code", "graph"]).optional(),
  depth: z.number().optional(),
  paths: z.array(z.string()),
});

const blastRadiusWireSchema = z.object({
  level: blastLevelSchema,
  factors: z.array(z.string()).optional(),
  changedPackageCount: z.number().int().nonnegative().optional(),
});

/** Strict canonical wire schema — single source of truth. */
export const repoIntelligenceWireSchema = z.object({
  packages: z.record(z.string(), packageIntelWireSchema),
  packageUsage: z.array(packageUsageWireSchema).optional(),
  blastRadius: blastRadiusWireSchema.optional(),
  applicationAreas: z.array(areaSchema).optional(),
  affectedAreas: z.array(areaSchema).optional(),
  hotspots: z.array(hotspotWireSchema).optional(),
  frameworks: z.array(z.string().min(1)).optional(),
  semanticDiagnostics: z.array(semanticDiagnosticSchema).optional(),
});

export type RepoIntelligence = z.infer<typeof repoIntelligenceWireSchema>;

export type ParseRepoIntelligenceSuccess = {
  ok: true;
  value: RepoIntelligence;
};

export type ParseRepoIntelligenceFailure = {
  ok: false;
  issues: string[];
  issueCount: number;
  packageCount: number;
};

export type ParseRepoIntelligenceResult =
  | ParseRepoIntelligenceSuccess
  | ParseRepoIntelligenceFailure;

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map(
    (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
  );
}

export function countRepoIntelligencePackages(raw: unknown): number {
  if (raw == null || typeof raw !== "object") return 0;
  const obj = raw as Record<string, unknown>;
  if (obj.packages != null && typeof obj.packages === "object") {
    return Object.keys(obj.packages as object).length;
  }
  if (Array.isArray(obj.packageUsage)) {
    return obj.packageUsage.length;
  }
  return 0;
}

export function safeParseRepoIntelligence(
  raw: unknown,
): ParseRepoIntelligenceResult {
  const packageCount = countRepoIntelligencePackages(raw);
  if (raw == null || typeof raw !== "object") {
    return {
      ok: false,
      issues: ["(root): expected object"],
      issueCount: 1,
      packageCount: 0,
    };
  }
  const parsed = repoIntelligenceWireSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = formatZodIssues(parsed.error);
    return {
      ok: false,
      issues,
      issueCount: issues.length,
      packageCount,
    };
  }
  const value = parsed.data;
  if (Object.keys(value).length === 0) {
    return {
      ok: false,
      issues: ["(root): empty object"],
      issueCount: 1,
      packageCount: 0,
    };
  }
  if (
    Object.keys(value.packages).length === 0 &&
    (value.packageUsage?.length ?? 0) === 0
  ) {
    return {
      ok: false,
      issues: ["packages: at least one package required"],
      issueCount: 1,
      packageCount: 0,
    };
  }
  return { ok: true, value };
}

/** Throws when wire block is present but invalid (CI / tests only). */
export function validateRepoIntelligenceWire(raw: unknown): RepoIntelligence {
  const r = safeParseRepoIntelligence(raw);
  if (!r.ok) {
    throw new Error(`repoIntelligence contract: ${r.issues.join("; ")}`);
  }
  return r.value;
}

/** CI helper — fails test when engine output includes invalid repoIntelligence. */
export function assertEngineOutputRepoIntelligenceValid(
  scan: ScanResult,
): void {
  if (scan.repoIntelligence == null) return;
  validateRepoIntelligenceWire(scan.repoIntelligence);
}

export function readBlastLevel(
  level: BlastRadiusLevel | undefined,
): BlastRadiusLevel | null {
  if (level === "narrow" || level === "moderate" || level === "wide") {
    return level;
  }
  return null;
}
