import type { RepoIntelligence } from "./repoIntelligenceSchema.js";

export type DependencyClass =
  | "runtime"
  | "tooling"
  | "test"
  | "lint"
  | "format"
  | "build"
  | "ci"
  | "unknown";

export type PackageRole =
  | "typechecker"
  | "compiler"
  | "bundler"
  | "linter"
  | "formatter"
  | "test_runner"
  | "http_framework"
  | "auth"
  | "queue"
  | "orm"
  | "unknown";

export type LockfileKind =
  | "production"
  | "development"
  | "optional"
  | "unknown";

export type RuntimeImpact = "none" | "possible" | "confirmed" | "unknown";

export type ExpectedImpact =
  | "runtime"
  | "build_time"
  | "typecheck"
  | "test_time"
  | "development_only"
  | "unknown";

export type EvidenceStrength = "high" | "medium" | "low";

export type ClassificationSource =
  | "registry"
  | "graph"
  | "lockfile"
  | "heuristic"
  | "unknown";

export type SemanticDiagnostic = {
  packageName: string;
  ruleId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reason: string;
};

export type SanitizeRepoIntelligenceResult = {
  wire: RepoIntelligence;
  diagnostics: SemanticDiagnostic[];
  degradedPackages: string[];
};

const TOOLING_CLASSES = new Set<DependencyClass>([
  "tooling",
  "test",
  "lint",
  "format",
  "build",
  "ci",
]);

const RUNTIME_VERIFICATION = new Set([
  "auth_flow",
  "route_handlers",
  "routes",
  "handlers",
  "serialization",
  "hooks",
  "plugins",
  "session",
  "auth",
  "queue",
  "workers",
]);

type PackageRow = RepoIntelligence["packages"][string];

function cloneWire(wire: RepoIntelligence): RepoIntelligence {
  return structuredClone(wire);
}

function isToolingClass(dc: DependencyClass | undefined): boolean {
  return dc != null && TOOLING_CLASSES.has(dc);
}

function stripRuntimeVerification(focus: string[] | undefined): string[] {
  if (!focus?.length) return [];
  return focus.filter((f) => !RUNTIME_VERIFICATION.has(f));
}

function applyS1(row: PackageRow): boolean {
  return row.runtimeSurface === "runtime" && row.reachability === "unreachable";
}

function applyS2(row: PackageRow): boolean {
  return (
    row.runtimeImpact === "none" && row.reachability === "on_runtime_paths"
  );
}

function applyS3(row: PackageRow): boolean {
  return (
    isToolingClass(row.dependencyClass) && row.runtimeImpact === "confirmed"
  );
}

function applyS4(row: PackageRow): boolean {
  return (
    row.runtimeImpact === "confirmed" && (row.usage?.files?.length ?? 0) === 0
  );
}

function applyS5(row: PackageRow): boolean {
  if (!row.suppressRuntimeNarrative) return false;
  const focus = row.verificationFocus ?? [];
  return focus.some((f) => RUNTIME_VERIFICATION.has(f));
}

function sanitizePackageRow(
  packageName: string,
  row: PackageRow,
): { row: PackageRow; diagnostics: SemanticDiagnostic[]; degraded: boolean } {
  const diagnostics: SemanticDiagnostic[] = [];
  let degraded = false;
  const next: PackageRow = { ...row };

  const record = (
    ruleId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    reason: string,
  ) => {
    diagnostics.push({ packageName, ruleId, before, after, reason });
    degraded = true;
  };

  if (applyS1(next)) {
    const before = {
      runtimeSurface: next.runtimeSurface,
      reachability: next.reachability,
    };
    next.runtimeSurface = "build";
    next.reachability = "build_only";
    next.runtimeImpact = next.runtimeImpact ?? "none";
    next.suppressRuntimeNarrative = true;
    record(
      "S1",
      before,
      { runtimeSurface: next.runtimeSurface, reachability: next.reachability },
      "runtime_surface_unreachable",
    );
  }

  if (applyS3(next)) {
    const before = { runtimeImpact: next.runtimeImpact };
    next.runtimeImpact = "none";
    next.suppressRuntimeNarrative = true;
    record(
      "S3",
      before,
      { runtimeImpact: next.runtimeImpact },
      "tooling_confirmed_without_proof",
    );
  }

  if (applyS4(next)) {
    const before = { runtimeImpact: next.runtimeImpact };
    next.runtimeImpact = "none";
    next.evidenceStrength = "low";
    next.suppressRuntimeNarrative = true;
    record(
      "S4",
      before,
      { runtimeImpact: next.runtimeImpact },
      "confirmed_without_imports",
    );
  }

  if (applyS2(next)) {
    const before = { reachability: next.reachability };
    next.reachability = "unknown";
    record(
      "S2",
      before,
      { reachability: next.reachability },
      "none_but_on_runtime_paths",
    );
  }

  if (applyS5(next)) {
    const before = { verificationFocus: next.verificationFocus };
    next.verificationFocus = stripRuntimeVerification(next.verificationFocus);
    record(
      "S5",
      before,
      { verificationFocus: next.verificationFocus },
      "runtime_focus_while_suppressed",
    );
  }

  if (
    next.runtimeSurface === "runtime" &&
    next.reachability === "unreachable"
  ) {
    next.runtimeSurface = "unknown";
    next.reachability = "unknown";
    next.suppressRuntimeNarrative = true;
    degraded = true;
  }

  if (next.suppressRuntimeNarrative && next.runtimeImpact === "confirmed") {
    next.runtimeImpact = "unknown";
    degraded = true;
  }

  return { row: next, diagnostics, degraded };
}

/**
 * Hard gate: normalize contradictory package intelligence before wire emit.
 */
export function sanitizeRepoIntelligenceSemantics(
  draft: RepoIntelligence,
): SanitizeRepoIntelligenceResult {
  const wire = cloneWire(draft);
  const diagnostics: SemanticDiagnostic[] = [];
  const degradedPackages: string[] = [];

  for (const [packageName, row] of Object.entries(wire.packages)) {
    const result = sanitizePackageRow(packageName, row);
    wire.packages[packageName] = result.row;
    diagnostics.push(...result.diagnostics);
    if (result.degraded) degradedPackages.push(packageName);
  }

  if (diagnostics.length > 0) {
    wire.semanticDiagnostics = [
      ...(wire.semanticDiagnostics ?? []),
      ...diagnostics,
    ];
  }

  return { wire, diagnostics, degradedPackages };
}

/** Returns true when wire is safe for runtime narrative tier1. */
export function isRuntimeNarrativeSafe(row: PackageRow | undefined): boolean {
  if (!row) return false;
  if (row.suppressRuntimeNarrative === true) return false;
  if (row.runtimeImpact === "none") return false;
  if (row.runtimeSurface === "runtime" && row.reachability === "unreachable") {
    return false;
  }
  if (row.runtimeImpact === "confirmed" || row.runtimeImpact === "possible") {
    return true;
  }
  if (row.runtimeImpact === "unknown") return false;
  // ABI 1 wire without semantic fields: allow non-contradictory surface/reach pairs.
  return row.runtimeSurface != null && row.reachability != null;
}
