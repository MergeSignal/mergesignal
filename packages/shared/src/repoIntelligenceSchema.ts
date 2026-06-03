import { z } from "zod";
import type {
  BlastRadiusLevel,
  ReachabilityKind,
  RuntimeSurfaceKind,
} from "./scanNarrativeFacts.js";

const surfaceKindSchema = z.enum(["runtime", "build", "test", "unknown"]);

const reachabilityKindSchema = z.enum([
  "on_runtime_paths",
  "build_only",
  "test_only",
  "unreachable",
  "unknown",
]);

const blastLevelSchema = z.enum(["narrow", "moderate", "wide"]);

const looseSurfaceSchema = z.union([
  surfaceKindSchema,
  z.string(),
  z.object({ kind: z.string() }).passthrough(),
]);

const looseReachabilitySchema = z.union([
  reachabilityKindSchema,
  z.string(),
  z.object({ kind: z.string() }).passthrough(),
]);

const packageUsageEntrySchema = z
  .object({
    packageName: z.string().optional(),
    package: z.string().optional(),
    files: z.array(z.string()).optional(),
    paths: z.array(z.string()).optional(),
    criticalPaths: z.array(z.string()).optional(),
    areas: z.array(z.string()).optional(),
  })
  .passthrough();

const packageIntelSchema = z
  .object({
    runtimeSurface: looseSurfaceSchema.optional(),
    reachability: looseReachabilitySchema.optional(),
    packageUsage: packageUsageEntrySchema.optional(),
    usage: packageUsageEntrySchema.optional(),
    areas: z.array(z.string()).optional(),
    hotspots: z
      .array(
        z
          .object({
            packageName: z.string().optional(),
            paths: z.array(z.string()).optional(),
            depth: z.number().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

const areaSchema = z
  .object({
    id: z.string(),
    label: z.string(),
  })
  .passthrough();

export const repoIntelligenceSchema = z
  .object({
    packages: z.record(z.string(), packageIntelSchema).optional(),
    packageUsage: z.array(packageUsageEntrySchema).optional(),
    blastRadius: z
      .object({
        level: blastLevelSchema.optional(),
        factors: z.array(z.string()).optional(),
        changedPackageCount: z.number().optional(),
      })
      .passthrough()
      .optional(),
    runtimeSurface: looseSurfaceSchema.optional(),
    reachability: looseReachabilitySchema.optional(),
    applicationAreas: z.array(areaSchema).optional(),
    affectedAreas: z.array(areaSchema).optional(),
    hotspots: z
      .array(
        z
          .object({
            packageName: z.string(),
            source: z.enum(["code", "graph"]).optional(),
            depth: z.number().optional(),
            paths: z.array(z.string()).optional(),
          })
          .passthrough(),
      )
      .optional(),
    frameworks: z.array(z.string()).optional(),
  })
  .passthrough();

export type RepoIntelligence = z.infer<typeof repoIntelligenceSchema>;

export function parseRepoIntelligence(raw: unknown): RepoIntelligence | null {
  if (raw == null || typeof raw !== "object") return null;
  const parsed = repoIntelligenceSchema.safeParse(raw);
  if (!parsed.success) return null;
  const value = parsed.data;
  if (Object.keys(value).length === 0) return null;
  if (
    Object.keys(value).length === 1 &&
    value.packages &&
    Object.keys(value.packages).length === 0
  ) {
    return null;
  }
  return value;
}

const RUNTIME_SURFACE_ALIASES: ReadonlyArray<[RegExp, RuntimeSurfaceKind]> = [
  [/\bruntime\b/i, "runtime"],
  [/\bproduction\b/i, "runtime"],
  [/\bapi\b/i, "runtime"],
  [/\bbuild\b/i, "build"],
  [/\bdev(?:elopment)?\b/i, "build"],
  [/\btypescript\b/i, "build"],
  [/\btest\b/i, "test"],
  [/\bvitest\b/i, "test"],
  [/\bjest\b/i, "test"],
];

const REACHABILITY_ALIASES: ReadonlyArray<[RegExp, ReachabilityKind]> = [
  [/\bon[_\s-]?runtime/i, "on_runtime_paths"],
  [/\bruntime[_\s-]?path/i, "on_runtime_paths"],
  [/\bdirect\b/i, "on_runtime_paths"],
  [/\bbuild[_\s-]?only/i, "build_only"],
  [/\btest[_\s-]?only/i, "test_only"],
  [/\bunreachable\b/i, "unreachable"],
];

export function normalizeRuntimeSurfaceKind(
  raw: string | undefined,
): RuntimeSurfaceKind {
  if (!raw?.trim()) return "unknown";
  const t = raw.trim().toLowerCase();
  if (t === "runtime" || t === "build" || t === "test" || t === "unknown") {
    return t;
  }
  for (const [re, kind] of RUNTIME_SURFACE_ALIASES) {
    if (re.test(t)) return kind;
  }
  return "unknown";
}

export function normalizeReachabilityKind(
  raw: string | undefined,
): ReachabilityKind {
  if (!raw?.trim()) return "unknown";
  const t = raw.trim().toLowerCase();
  if (
    t === "on_runtime_paths" ||
    t === "build_only" ||
    t === "test_only" ||
    t === "unreachable" ||
    t === "unknown"
  ) {
    return t;
  }
  for (const [re, kind] of REACHABILITY_ALIASES) {
    if (re.test(t)) return kind;
  }
  return "unknown";
}

export function readSurfaceFromLoose(
  value: z.infer<typeof looseSurfaceSchema> | undefined,
): RuntimeSurfaceKind | null {
  if (value == null) return null;
  if (typeof value === "string") return normalizeRuntimeSurfaceKind(value);
  if (typeof value === "object" && "kind" in value) {
    return normalizeRuntimeSurfaceKind(String(value.kind));
  }
  return null;
}

export function readReachabilityFromLoose(
  value: z.infer<typeof looseReachabilitySchema> | undefined,
): ReachabilityKind | null {
  if (value == null) return null;
  if (typeof value === "string") return normalizeReachabilityKind(value);
  if (typeof value === "object" && "kind" in value) {
    return normalizeReachabilityKind(String(value.kind));
  }
  return null;
}

export function readBlastLevel(
  level: BlastRadiusLevel | undefined,
): BlastRadiusLevel | null {
  if (level === "narrow" || level === "moderate" || level === "wide") {
    return level;
  }
  return null;
}
