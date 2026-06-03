import type { ScanNarrativeFacts } from "./scanNarrativeFacts.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";

export type SummarizePackageUsageOptions = {
  maxPaths?: number;
  maxPackages?: number;
};

export type PackageUsageSummary = {
  pathCount: number;
  pathSamples: string[];
  areaLabels: string[];
  packageNames: string[];
};

export type ReachabilitySummary = {
  kindLabel: string | null;
  pathSamples: string[];
  frameworks: string[];
};

export type BlastRadiusSummary = {
  levelLabel: string | null;
  factors: string[];
  changedPackageCount: number | null;
};

export function selectPrimaryChangedPackage(
  facts: ScanNarrativeFacts,
): string | null {
  return facts.changedPackages.primary;
}

export function formatChangedPackagesShort(
  facts: ScanNarrativeFacts,
  maxNames = 2,
): string | null {
  const { primary, others } = facts.changedPackages;
  if (!primary) return null;
  if (others.length === 0) return primary;
  if (maxNames >= 2 && others.length === 1) {
    return `${primary}, ${others[0]}`;
  }
  return `${primary} +${others.length}`;
}

export function formatChangedPackagesDetail(
  facts: ScanNarrativeFacts,
): string[] {
  return facts.changedPackages.all;
}

export function summarizePackageUsage(
  facts: ScanNarrativeFacts,
  options: SummarizePackageUsageOptions = {},
): PackageUsageSummary | null {
  const maxPaths = options.maxPaths ?? 3;
  const maxPackages = options.maxPackages ?? 5;
  const rows = facts.packageUsage.slice(0, maxPackages);
  if (rows.length === 0) return null;

  const pathSamples: string[] = [];
  let pathCount = 0;
  const areaLabels: string[] = [];
  const packageNames: string[] = [];

  for (const row of rows) {
    packageNames.push(row.packageName);
    const rowPaths = [...row.paths, ...row.criticalPaths, ...row.files].filter(
      Boolean,
    );
    pathCount += rowPaths.length;
    for (const p of rowPaths) {
      if (pathSamples.length >= maxPaths) break;
      if (!pathSamples.includes(p)) pathSamples.push(p);
    }
    for (const a of row.areas) {
      if (!areaLabels.includes(a)) areaLabels.push(a);
    }
  }

  if (pathCount === 0 && areaLabels.length === 0) return null;

  return { pathCount, pathSamples, areaLabels, packageNames };
}

function labelRuntimeSurface(facts: ScanNarrativeFacts): string | null {
  const rs = facts.runtimeSurface;
  if (!rs) return null;
  return scanSurfaceCopy.narrativeCard.runtimeSurface[rs.kind];
}

function labelReachabilityKind(facts: ScanNarrativeFacts): string | null {
  const r = facts.reachability;
  if (!r) return null;
  return scanSurfaceCopy.narrativeCard.reachability[r.kind];
}

function labelBlastRadiusLevel(facts: ScanNarrativeFacts): string | null {
  const br = facts.blastRadius;
  if (!br) return null;
  return scanSurfaceCopy.narrativeCard.blastRadius[br.level];
}

export function summarizeReachability(
  facts: ScanNarrativeFacts,
  maxPaths = 1,
): ReachabilitySummary {
  const kindLabel = labelReachabilityKind(facts);
  const paths = facts.reachability?.evidence.paths ?? [];
  const frameworks =
    facts.reachability?.evidence.frameworks ?? facts.frameworks;
  return {
    kindLabel,
    pathSamples: paths.slice(0, maxPaths),
    frameworks: frameworks.slice(0, 3),
  };
}

export function summarizeBlastRadius(
  facts: ScanNarrativeFacts,
  maxFactors = 3,
): BlastRadiusSummary {
  const br = facts.blastRadius;
  return {
    levelLabel: labelBlastRadiusLevel(facts),
    factors: (br?.factors ?? []).slice(0, maxFactors),
    changedPackageCount: br?.changedPackageCount ?? null,
  };
}

export function summarizeHotspots(
  facts: ScanNarrativeFacts,
  max = 5,
): Array<{
  packageName: string;
  source: "code" | "graph";
  pathSample: string | null;
}> {
  return facts.hotspots.slice(0, max).map((h) => ({
    packageName: h.packageName,
    source: h.source,
    pathSample: h.paths[0] ?? null,
  }));
}

export type SelectReviewerGuidanceOptions = {
  scope?: "changed" | "all" | "any";
  max?: number;
};

export function selectReviewerGuidance(
  facts: ScanNarrativeFacts,
  options: SelectReviewerGuidanceOptions = {},
): ScanNarrativeFacts["reviewerGuidance"] {
  const max = options.max ?? 6;
  let list = facts.reviewerGuidance;
  if (options.scope === "changed") {
    list = list.filter((g) => g.scope === "changed");
  } else if (options.scope === "all") {
    list = list.filter((g) => g.scope === "all");
  }
  return list.slice(0, max);
}

export function composeVerificationPrompt(
  facts: ScanNarrativeFacts,
): string | null {
  const changed = selectReviewerGuidance(facts, { scope: "changed", max: 1 });
  const remediation = changed[0]?.remediation?.trim();
  if (remediation) return remediation;

  const usage = summarizePackageUsage(facts, { maxPaths: 1 });
  if (usage?.pathSamples[0]) {
    return `Confirm behavior where this dependency is used (${usage.pathSamples[0]}).`;
  }

  const any = selectReviewerGuidance(facts, { max: 1 });
  return any[0]?.remediation?.trim() ?? null;
}

export function formatUsageSummaryLine(
  facts: ScanNarrativeFacts,
  maxPaths = 1,
): string | null {
  const usage = summarizePackageUsage(facts, { maxPaths });
  if (!usage) return null;

  if (usage.pathSamples.length > 0) {
    const sample = usage.pathSamples[0];
    if (usage.pathCount <= 1) {
      return `Used in ${sample}`;
    }
    return `Used in ${usage.pathCount} paths (${sample})`;
  }

  if (usage.areaLabels.length > 0) {
    return `Used in ${usage.areaLabels.slice(0, 2).join(", ")}`;
  }

  return null;
}

export function formatBlastRadiusDetailLine(
  facts: ScanNarrativeFacts,
  maxFactors = 1,
): string | null {
  const summary = summarizeBlastRadius(facts, maxFactors);
  if (summary.factors.length === 0) return null;
  const factor = summary.factors[0]!.replace(/_/g, " ");
  if (summary.levelLabel) {
    return `${summary.levelLabel}: ${factor}`;
  }
  return factor;
}

export function formatFrameworksSummary(
  facts: ScanNarrativeFacts,
  max = 2,
): string | null {
  const frameworks = facts.frameworks.slice(0, max);
  if (frameworks.length === 0) return null;
  if (frameworks.length === 1) return frameworks[0]!;
  return frameworks.join(", ");
}

export function composeContextLineFromFacts(
  facts: ScanNarrativeFacts,
  options: { includePathSample?: boolean; maxAreas?: number } = {},
): string | null {
  const parts: string[] = [];
  const runtime = labelRuntimeSurface(facts);
  const reach = summarizeReachability(facts, options.includePathSample ? 1 : 0);
  const blast = labelBlastRadiusLevel(facts);

  if (runtime) parts.push(runtime);
  if (reach.kindLabel) {
    if (options.includePathSample && reach.pathSamples[0]) {
      parts.push(`${reach.kindLabel} (${reach.pathSamples[0]})`);
    } else {
      parts.push(reach.kindLabel);
    }
  }
  if (blast) parts.push(blast);

  const maxAreas = options.maxAreas ?? 2;
  const areaLabels: string[] = [];
  for (const area of facts.affectedAreas) {
    if (areaLabels.length >= maxAreas) break;
    if (!areaLabels.includes(area.label)) areaLabels.push(area.label);
  }
  if (areaLabels.length > 0) {
    parts.push(areaLabels.join(scanSurfaceCopy.narrativeCard.areasSeparator));
  }

  if (parts.length === 0) return null;
  return parts.join(scanSurfaceCopy.narrativeCard.contextSeparator);
}

export { labelRuntimeSurface, labelReachabilityKind, labelBlastRadiusLevel };
