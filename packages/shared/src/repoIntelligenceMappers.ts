import type {
  BlastRadiusLevel,
  ReachabilityKind,
  RuntimeSurfaceKind,
} from "./scanNarrativeFacts.js";

/** Engine-internal blast radius vocabulary → canonical wire. */
export type EngineBlastRadiusLevel = "small" | "moderate" | "large";

/** Engine-internal reachability spread buckets. */
export type EngineReachabilityBucket = "very_low" | "low" | "moderate" | "high";

/** Engine-internal runtime surface labels. */
export type EngineRuntimeSurface = "runtime" | "test" | "build" | "dev" | "ci";

export function mapBlastRadiusLevel(
  level: EngineBlastRadiusLevel,
): BlastRadiusLevel {
  switch (level) {
    case "small":
      return "narrow";
    case "moderate":
      return "moderate";
    case "large":
      return "wide";
    default: {
      const x: never = level;
      return x;
    }
  }
}

export function mapRuntimeSurfaceKind(
  surface: EngineRuntimeSurface,
): RuntimeSurfaceKind {
  switch (surface) {
    case "runtime":
      return "runtime";
    case "test":
      return "test";
    case "build":
    case "dev":
    case "ci":
      return "build";
    default:
      return "unknown";
  }
}

/**
 * Maps engine reachability spread + runtime classification to narrative reachability kind.
 * Documented in repoIntelligenceSchema.ts header.
 */
export function mapReachabilityKind(input: {
  bucket: EngineReachabilityBucket;
  reachesRuntime: boolean;
  dominantSurface: EngineRuntimeSurface;
}): ReachabilityKind {
  const { bucket, reachesRuntime, dominantSurface } = input;

  if (dominantSurface === "test" && !reachesRuntime) {
    return "test_only";
  }
  if (
    (dominantSurface === "build" ||
      dominantSurface === "dev" ||
      dominantSurface === "ci") &&
    !reachesRuntime
  ) {
    return "build_only";
  }
  if (reachesRuntime) {
    return "on_runtime_paths";
  }
  if (bucket === "very_low" || bucket === "low") {
    return "unreachable";
  }
  if (bucket === "moderate" || bucket === "high") {
    if (dominantSurface === "test") return "test_only";
    if (
      dominantSurface === "build" ||
      dominantSurface === "dev" ||
      dominantSurface === "ci"
    ) {
      return "build_only";
    }
    return "unknown";
  }
  return "unknown";
}

export function areaSlugToLabel(slug: string): string {
  return slug
    .split("_")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
