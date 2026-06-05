import type {
  ChangedPackageSemantics,
  PackageDependencyClass,
  PackageEvidenceStrength,
  PackageExpectedImpact,
  PackageRuntimeImpact,
  ScanNarrativeFacts,
} from "../../scanNarrativeFacts.js";
import { formatCardAreaLabels } from "../../formatCardAreaLabels.js";
import { mergeVerificationFocusLabels } from "./verificationFocusLabels.js";
import type {
  PresentationIntent,
  PresentationInterpretation,
} from "./presentationIntent.js";

const TOOLING_CLASSES = new Set<PackageDependencyClass>([
  "tooling",
  "test",
  "lint",
  "format",
  "build",
  "ci",
]);

const RUNTIME_IMPACT_RANK: Record<string, number> = {
  confirmed: 3,
  possible: 2,
  unknown: 1,
  none: 0,
};

const EVIDENCE_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function isRuntimeEligible(row: ChangedPackageSemantics): boolean {
  if (row.suppressRuntimeNarrative) return false;
  if (row.runtimeImpact === "confirmed" || row.runtimeImpact === "possible") {
    return true;
  }
  if (row.dependencyClass === "runtime") return true;
  if (row.usagePathCount > 0) return true;
  return false;
}

function isToolingOriented(row: ChangedPackageSemantics): boolean {
  if (row.suppressRuntimeNarrative) return true;
  if (row.dependencyClass && TOOLING_CLASSES.has(row.dependencyClass)) {
    return true;
  }
  return false;
}

function compareRuntimePackages(
  a: ChangedPackageSemantics,
  b: ChangedPackageSemantics,
  order: string[],
): number {
  const impactA = RUNTIME_IMPACT_RANK[a.runtimeImpact ?? "none"] ?? 0;
  const impactB = RUNTIME_IMPACT_RANK[b.runtimeImpact ?? "none"] ?? 0;
  if (impactB !== impactA) return impactB - impactA;
  const evA = EVIDENCE_RANK[a.evidenceStrength ?? "low"] ?? 0;
  const evB = EVIDENCE_RANK[b.evidenceStrength ?? "low"] ?? 0;
  if (evB !== evA) return evB - evA;
  return order.indexOf(a.packageName) - order.indexOf(b.packageName);
}

function pickAnchorPackage(
  rows: ChangedPackageSemantics[],
  changedOrder: string[],
): string | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) =>
    compareRuntimePackages(a, b, changedOrder),
  );
  return sorted[0]?.packageName ?? null;
}

function pickToolingAnchor(
  rows: ChangedPackageSemantics[],
  changedOrder: string[],
): string | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort(
    (a, b) =>
      changedOrder.indexOf(a.packageName) - changedOrder.indexOf(b.packageName),
  );
  return sorted[0]?.packageName ?? null;
}

function isToolingPatchSet(
  rows: ChangedPackageSemantics[],
  facts: ScanNarrativeFacts,
): boolean {
  if (rows.length === 0) return false;
  const narrow = !facts.blastRadius || facts.blastRadius.level === "narrow";
  if (!narrow) return false;
  return rows.every(
    (row) =>
      row.suppressRuntimeNarrative &&
      (row.expectedImpact === "typecheck" ||
        row.expectedImpact === "build_time"),
  );
}

function runtimeSurfaceLabelFromFacts(
  facts: ScanNarrativeFacts,
  anchorRow: ChangedPackageSemantics | undefined,
): string | null {
  const area = facts.affectedAreas[0];
  if (area) {
    const formatted = formatCardAreaLabels([area.label], 1);
    return formatted[0] ?? area.label;
  }
  if (anchorRow?.packageRole === "http_framework") {
    return "API request handling";
  }
  if (anchorRow?.packageRole === "auth") {
    return "authentication flows";
  }
  if (anchorRow?.packageRole === "queue") {
    return "background job processing";
  }
  return "application code";
}

function collectVerificationLabels(rows: ChangedPackageSemantics[]): string[] {
  return mergeVerificationFocusLabels(rows.map((r) => r.verificationFocus));
}

function showLimitedEvidence(rows: ChangedPackageSemantics[]): boolean {
  return rows.some((r) => r.evidenceStrength === "low");
}

function dominantExpectedImpact(
  rows: ChangedPackageSemantics[],
): PackageExpectedImpact | null {
  for (const row of rows) {
    if (row.expectedImpact && row.expectedImpact !== "unknown") {
      return row.expectedImpact;
    }
  }
  return null;
}

function emptyInterpretation(
  intent: PresentationIntent,
): PresentationInterpretation {
  return {
    intent,
    anchorPackage: null,
    suppressRuntimeNarrative: intent.startsWith("tooling"),
    allowRuntimeNarrative: intent.includes("runtime"),
    showLimitedEvidence: false,
    expectedImpactKey: null,
    verificationLabels: [],
    runtimeSurfaceLabel: null,
    runtimePackages: [],
  };
}

export function derivePresentationInterpretation(
  facts: ScanNarrativeFacts,
): PresentationInterpretation {
  const changedOrder = facts.changedPackages.all;
  const semantics =
    facts.changedPackageSemantics.length > 0
      ? facts.changedPackageSemantics
      : facts.packageSemantics && facts.changedPackages.primary
        ? [
            {
              packageName: facts.changedPackages.primary,
              dependencyClass: facts.packageSemantics.dependencyClass,
              packageRole: facts.packageSemantics.packageRole,
              runtimeImpact: facts.packageSemantics.runtimeImpact,
              expectedImpact: facts.packageSemantics.expectedImpact,
              suppressRuntimeNarrative:
                facts.packageSemantics.suppressRuntimeNarrative,
              evidenceStrength: facts.packageSemantics.evidenceStrength,
              verificationFocus: facts.packageSemantics.verificationFocus,
              usagePathCount: 0,
              usageAreaCount: 0,
            },
          ]
        : [];

  const tier1Ok =
    facts.availability.tiersPresent.tier1 &&
    facts.availability.repoIntelligenceParse === "ok";

  if (!tier1Ok) {
    return emptyInterpretation("limited_context");
  }

  if (!facts.changedPackages.primary) {
    return emptyInterpretation("no_changed_packages");
  }

  const runtimeEligible = semantics.filter(isRuntimeEligible);

  if (runtimeEligible.length > 0) {
    const anchorPackage = pickAnchorPackage(runtimeEligible, changedOrder);
    const anchorRow = runtimeEligible.find(
      (r) => r.packageName === anchorPackage,
    );
    const runtimeSurfaceLabel = runtimeSurfaceLabelFromFacts(facts, anchorRow);
    const verificationLabels = collectVerificationLabels(runtimeEligible);

    let intent: PresentationIntent = "runtime_upgrade";
    if (runtimeEligible.length > 1) {
      intent = "multi_runtime_upgrade";
    } else if (runtimeEligible.some((r) => r.packageRole === "auth")) {
      intent = "auth_runtime_upgrade";
    } else if (runtimeEligible.some((r) => r.packageRole === "queue")) {
      intent = "queue_runtime_upgrade";
    }

    return {
      intent,
      anchorPackage,
      suppressRuntimeNarrative: false,
      allowRuntimeNarrative: true,
      showLimitedEvidence: showLimitedEvidence(runtimeEligible),
      expectedImpactKey: dominantExpectedImpact(runtimeEligible),
      verificationLabels,
      runtimeSurfaceLabel,
      runtimePackages: runtimeEligible.map((r) => r.packageName),
    };
  }

  const toolingOnly =
    semantics.length > 0 && semantics.every(isToolingOriented);

  if (toolingOnly) {
    const anchorPackage = pickToolingAnchor(semantics, changedOrder);
    const isPatch = isToolingPatchSet(semantics, facts);
    const intent: PresentationIntent = isPatch
      ? "tooling_patch"
      : "tooling_upgrade";
    const anchorRow = semantics.find((r) => r.packageName === anchorPackage);

    return {
      intent,
      anchorPackage,
      suppressRuntimeNarrative: true,
      allowRuntimeNarrative: false,
      showLimitedEvidence: showLimitedEvidence(semantics),
      expectedImpactKey: anchorRow?.expectedImpact ?? null,
      verificationLabels: collectVerificationLabels(semantics),
      runtimeSurfaceLabel: null,
      runtimePackages: [],
    };
  }

  return {
    ...emptyInterpretation("unknown_upgrade"),
    anchorPackage: facts.changedPackages.primary,
    verificationLabels: collectVerificationLabels(semantics),
    showLimitedEvidence: showLimitedEvidence(semantics),
    expectedImpactKey: dominantExpectedImpact(semantics),
  };
}
