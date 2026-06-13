import { extractRepositoryContextFacts } from "./extractRepositoryContextFacts.js";
import {
  readBlastLevel,
  safeParseRepoIntelligence,
  type RepoIntelligence,
} from "./repoIntelligenceSchema.js";
import { isRuntimeNarrativeSafe } from "./repoIntelligenceSemantics.js";
import {
  EMPTY_SCAN_NARRATIVE_FACTS,
  NARRATIVE_FACT_MAX_AREAS,
  NARRATIVE_FACT_MAX_HOTSPOTS,
  NARRATIVE_FACT_MAX_PATHS,
  type BlastRadiusLevel,
  type ChangedPackageSemantics,
  type NarrativeAvailabilityMode,
  type NarrativePackageUsage,
  type PackageSemanticsSummary,
  type ReachabilityKind,
  type RepoIntelligenceParseStatus,
  type ReviewerGuidanceKind,
  type ReviewerGuidanceScope,
  type RuntimeSurfaceKind,
  type ScanNarrativeFacts,
} from "./scanNarrativeFacts.js";
import { mergePostureFromDecision } from "./riskVocabulary.js";
import { selectTopAffectedAreas } from "./selectTopAffectedAreas.js";
import type {
  DependencyGraphInsight,
  Finding,
  PRInsight,
  Recommendation,
  ScanResult,
} from "./types.js";

function parseChangedPackages(
  changed: string[] | undefined,
): ScanNarrativeFacts["changedPackages"] {
  const all = Array.isArray(changed)
    ? changed.map((p) => p.trim()).filter(Boolean)
    : [];
  return {
    primary: all[0] ?? null,
    others: all.slice(1),
    all,
  };
}

function changedPackagesFromAssessment(
  result: ScanResult,
): ScanNarrativeFacts["changedPackages"] {
  const assessment = result.assessment;
  const focal = assessment?.reviewFocalPoint;
  // Follow-up: remove parseChangedPackages fallback after historical scan re-scan window.
  if (focal?.anchors?.length && focal.anchors[0] !== "dependency_graph") {
    const token = focal.anchors[0]!;
    const primary = token.includes("+") ? token.split("+")[0]! : token;
    const supporting = focal.supportingPackages ?? [];
    const all = [
      ...new Set([primary, ...supporting, ...(result.changedPackages ?? [])]),
    ].sort((a, b) => a.localeCompare(b));
    return {
      primary,
      others: all.filter((p) => p !== primary),
      all,
    };
  }
  return parseChangedPackages(result.changedPackages);
}

function blastLevelFromChangedCount(count: number): BlastRadiusLevel {
  if (count >= 8) return "wide";
  if (count >= 3) return "moderate";
  return "narrow";
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function collectPackageUsageForChanged(
  ri: RepoIntelligence,
  changed: ScanNarrativeFacts["changedPackages"],
): NarrativePackageUsage[] {
  const byPackage = new Map<string, NarrativePackageUsage>();

  const ensure = (packageName: string): NarrativePackageUsage => {
    let row = byPackage.get(packageName);
    if (!row) {
      row = {
        packageName,
        paths: [],
        criticalPaths: [],
        files: [],
        areas: [],
      };
      byPackage.set(packageName, row);
    }
    return row;
  };

  const mergeEntry = (
    entry: {
      packageName: string;
      paths?: string[];
      criticalPaths?: string[];
      files?: string[];
      areas?: string[];
    },
    packageNameOverride?: string,
  ) => {
    const name = packageNameOverride ?? entry.packageName.trim();
    if (!changed.all.includes(name)) return;
    const row = ensure(name);
    row.paths = uniqueStrings([...row.paths, ...(entry.paths ?? [])]);
    row.criticalPaths = uniqueStrings([
      ...row.criticalPaths,
      ...(entry.criticalPaths ?? []),
    ]);
    row.files = uniqueStrings([...row.files, ...(entry.files ?? [])]);
    row.areas = uniqueStrings([...row.areas, ...(entry.areas ?? [])]);
  };

  for (const name of changed.all) {
    const pkgIntel = ri.packages?.[name];
    if (pkgIntel?.usage) mergeEntry(pkgIntel.usage, name);
    if (pkgIntel?.areas?.length) {
      const row = ensure(name);
      row.areas = uniqueStrings([...row.areas, ...pkgIntel.areas]);
    }
  }

  if (Array.isArray(ri.packageUsage)) {
    for (const entry of ri.packageUsage) {
      mergeEntry(entry);
    }
  }

  return changed.all
    .map((name) => byPackage.get(name))
    .filter((row): row is NarrativePackageUsage => row != null);
}

function allUsagePaths(usage: NarrativePackageUsage[]): string[] {
  const paths: string[] = [];
  for (const row of usage) {
    paths.push(...row.paths, ...row.criticalPaths, ...row.files);
  }
  return uniqueStrings(paths).slice(0, NARRATIVE_FACT_MAX_PATHS);
}

function collectFrameworks(ri: RepoIntelligence): string[] {
  return uniqueStrings(ri.frameworks ?? []);
}

function collectCodeHotspots(
  ri: RepoIntelligence,
  primary: string | null,
): ScanNarrativeFacts["hotspots"] {
  const hotspots: ScanNarrativeFacts["hotspots"] = [];
  const pkgIntel =
    primary && ri.packages?.[primary] ? ri.packages[primary] : undefined;
  const riHotspots = ri.hotspots ?? [];
  for (const h of riHotspots) {
    const name = (h.packageName ?? primary ?? "").trim();
    if (!name) continue;
    hotspots.push({
      packageName: name,
      source: h.source === "graph" ? "graph" : "code",
      depth: h.depth,
      paths: uniqueStrings(h.paths ?? []),
    });
  }
  return hotspots;
}

function mergeGraphHotspots(
  codeHotspots: ScanNarrativeFacts["hotspots"],
  graphHotspots: DependencyGraphInsight[] | undefined,
): ScanNarrativeFacts["hotspots"] {
  const byName = new Map<string, ScanNarrativeFacts["hotspots"][number]>();
  for (const h of codeHotspots) {
    byName.set(h.packageName, h);
  }
  for (const g of graphHotspots ?? []) {
    const name = g.packageName?.trim();
    if (!name || byName.has(name)) continue;
    byName.set(name, {
      packageName: name,
      source: "graph",
      depth: g.depth,
      paths: [],
    });
  }
  return [...byName.values()].slice(0, NARRATIVE_FACT_MAX_HOTSPOTS);
}

function projectPackageSemanticsFromWire(
  pkgIntel: RepoIntelligence["packages"][string] | undefined,
): PackageSemanticsSummary | null {
  if (!pkgIntel) return null;
  return {
    dependencyClass: pkgIntel.dependencyClass ?? null,
    packageRole: pkgIntel.packageRole ?? null,
    runtimeImpact: pkgIntel.runtimeImpact ?? null,
    expectedImpact: pkgIntel.expectedImpact ?? null,
    suppressRuntimeNarrative: pkgIntel.suppressRuntimeNarrative === true,
    evidenceStrength: pkgIntel.evidenceStrength ?? null,
    verificationFocus: pkgIntel.verificationFocus ?? [],
  };
}

function projectChangedPackageSemantics(
  ri: RepoIntelligence,
  changed: ScanNarrativeFacts["changedPackages"],
): ChangedPackageSemantics[] {
  return changed.all.map((packageName) => {
    const pkgIntel = ri.packages?.[packageName];
    const usage = pkgIntel?.usage;
    const paths = usage?.paths ?? [];
    const criticalPaths = usage?.criticalPaths ?? [];
    const areas = usage?.areas ?? [];
    const summary = projectPackageSemanticsFromWire(pkgIntel);
    return {
      packageName,
      dependencyClass: summary?.dependencyClass ?? null,
      packageRole: summary?.packageRole ?? null,
      runtimeImpact: summary?.runtimeImpact ?? null,
      expectedImpact: summary?.expectedImpact ?? null,
      suppressRuntimeNarrative: summary?.suppressRuntimeNarrative ?? false,
      evidenceStrength: summary?.evidenceStrength ?? null,
      verificationFocus: summary?.verificationFocus ?? [],
      usagePathCount: paths.length + criticalPaths.length,
      usageAreaCount: areas.length,
    };
  });
}

function extractTier1FromRepoIntelligence(
  ri: RepoIntelligence,
  changed: ScanNarrativeFacts["changedPackages"],
): Pick<
  ScanNarrativeFacts,
  | "packageUsage"
  | "frameworks"
  | "runtimeSurface"
  | "reachability"
  | "packageSemantics"
  | "changedPackageSemantics"
  | "blastRadius"
  | "affectedAreas"
  | "hotspots"
> {
  const primary = changed.primary;
  const pkgIntel =
    primary && ri.packages?.[primary] ? ri.packages[primary] : undefined;

  const packageUsage = collectPackageUsageForChanged(ri, changed);
  const frameworks = collectFrameworks(ri);
  const paths = allUsagePaths(packageUsage);

  const suppressRuntime = pkgIntel?.suppressRuntimeNarrative === true;
  const narrativeSafe = isRuntimeNarrativeSafe(pkgIntel);

  const runtimeKind =
    narrativeSafe && !suppressRuntime
      ? (pkgIntel?.runtimeSurface ?? null)
      : null;
  const reachKind =
    narrativeSafe && !suppressRuntime ? (pkgIntel?.reachability ?? null) : null;

  const runtimeSurface =
    runtimeKind != null
      ? {
          kind: runtimeKind,
          evidence: {
            packages: primary ? [primary] : changed.all.slice(0, 3),
            paths,
          },
        }
      : null;

  const reachability = reachKind
    ? {
        kind: reachKind,
        evidence: {
          paths,
          frameworks,
        },
      }
    : null;

  const packageSemantics = projectPackageSemanticsFromWire(pkgIntel);
  const changedPackageSemantics = projectChangedPackageSemantics(ri, changed);

  const blastFromRi = ri.blastRadius;
  const blastLevel =
    readBlastLevel(blastFromRi?.level) ??
    (changed.all.length > 0
      ? blastLevelFromChangedCount(changed.all.length)
      : null);

  const blastRadius = blastLevel
    ? {
        level: blastLevel,
        changedPackageCount:
          blastFromRi?.changedPackageCount ?? changed.all.length,
        factors: uniqueStrings(blastFromRi?.factors ?? []),
      }
    : null;

  const areasRaw = ri.applicationAreas ?? ri.affectedAreas ?? [];
  const affectedAreas: ScanNarrativeFacts["affectedAreas"] = [];

  for (const area of areasRaw) {
    affectedAreas.push({ id: area.id, label: area.label });
  }
  for (const row of packageUsage) {
    for (const label of row.areas) {
      const id = label.toLowerCase().replace(/\s+/g, "_");
      if (!affectedAreas.some((a) => a.id === id)) {
        affectedAreas.push({ id, label });
      }
    }
  }

  const codeHotspots = collectCodeHotspots(ri, primary);

  return {
    packageUsage,
    frameworks,
    runtimeSurface,
    reachability,
    packageSemantics,
    changedPackageSemantics,
    blastRadius,
    affectedAreas: affectedAreas.slice(0, NARRATIVE_FACT_MAX_AREAS),
    hotspots: codeHotspots.slice(0, NARRATIVE_FACT_MAX_HOTSPOTS),
  };
}

function hasMeaningfulTier1(
  tier1: Pick<
    ScanNarrativeFacts,
    | "packageUsage"
    | "frameworks"
    | "runtimeSurface"
    | "reachability"
    | "packageSemantics"
    | "changedPackageSemantics"
    | "blastRadius"
    | "affectedAreas"
    | "hotspots"
  >,
): boolean {
  return (
    tier1.packageUsage.length > 0 ||
    tier1.frameworks.length > 0 ||
    tier1.runtimeSurface != null ||
    tier1.reachability != null ||
    tier1.packageSemantics?.expectedImpact != null ||
    tier1.changedPackageSemantics.length > 0 ||
    tier1.blastRadius != null ||
    tier1.affectedAreas.length > 0 ||
    tier1.hotspots.length > 0
  );
}

function insightScope(
  scope: PRInsight["scope"] | undefined,
): ReviewerGuidanceScope {
  if (scope === "changed" || scope === "all") return scope;
  return "unknown";
}

function guidanceFromInsight(
  insight: PRInsight,
  index: number,
): ScanNarrativeFacts["reviewerGuidance"][number] {
  return {
    kind: "insight",
    id: `insight:${index}:${insight.type}`,
    scope: insightScope(insight.scope),
    priority: insight.priority,
    message: insight.message,
    context: insight.context,
    remediation: insight.remediation,
    affectedFiles: insight.affectedFiles,
  };
}

function guidanceFromFinding(
  finding: Finding,
): ScanNarrativeFacts["reviewerGuidance"][number] {
  return {
    kind: "finding",
    id: finding.id,
    scope: "unknown",
    priority: finding.severity,
    message: finding.title,
    context: finding.description,
    remediation: finding.recommendation,
  };
}

function guidanceFromRecommendation(
  rec: Recommendation,
): ScanNarrativeFacts["reviewerGuidance"][number] {
  return {
    kind: "recommendation",
    id: rec.id,
    scope: "unknown",
    priority: String(rec.priorityScore ?? rec.rank ?? "medium"),
    message: rec.title,
    context: rec.rationale,
    remediation: rec.impact,
  };
}

function collectReviewerGuidance(
  result: ScanResult,
): ScanNarrativeFacts["reviewerGuidance"] {
  const guidance: ScanNarrativeFacts["reviewerGuidance"] = [];

  const insights = Array.isArray(result.insights) ? result.insights : [];
  const changedFirst = [
    ...insights.filter((i) => i.scope === "changed"),
    ...insights.filter((i) => i.scope !== "changed"),
  ];
  changedFirst.forEach((insight, index) => {
    guidance.push(guidanceFromInsight(insight, index));
  });

  const findings = Array.isArray(result.findings) ? result.findings : [];
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 } as const;
  const sortedFindings = [...findings].sort(
    (a, b) =>
      (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0),
  );
  for (const finding of sortedFindings) {
    guidance.push(guidanceFromFinding(finding));
  }

  const recs = Array.isArray(result.recommendations)
    ? result.recommendations
    : [];
  for (const rec of recs) {
    guidance.push(guidanceFromRecommendation(rec));
  }

  return guidance;
}

function resolveAvailabilityMode(
  tier1: boolean,
  tier2: boolean,
  codeIntelligenceAvailable: boolean,
): NarrativeAvailabilityMode {
  if (tier1 && codeIntelligenceAvailable) return "pr_intelligence";
  if (tier2) return "insights";
  return "graph_fallback";
}

function emptyTier1Blocks(): Pick<
  ScanNarrativeFacts,
  | "packageUsage"
  | "frameworks"
  | "runtimeSurface"
  | "reachability"
  | "packageSemantics"
  | "changedPackageSemantics"
  | "blastRadius"
  | "affectedAreas"
  | "hotspots"
> {
  return {
    packageUsage: [],
    frameworks: [],
    runtimeSurface: null,
    reachability: null,
    packageSemantics: null,
    changedPackageSemantics: [],
    blastRadius: null,
    affectedAreas: [],
    hotspots: [],
  };
}

function blastRadiusFromChangedCount(
  count: number,
): ScanNarrativeFacts["blastRadius"] {
  return {
    level: blastLevelFromChangedCount(count),
    changedPackageCount: count,
    factors: [],
  };
}

function resolveTrustedRepoIntelligence(result: ScanResult): {
  parsed: RepoIntelligence | null;
  parseStatus: RepoIntelligenceParseStatus;
} {
  const raw = result.repoIntelligence;
  const validationStatus =
    result.analysisPreparation?.repoIntelligenceValidation?.status;

  if (raw == null) {
    return { parsed: null, parseStatus: "absent" };
  }

  if (validationStatus === "invalid") {
    return { parsed: null, parseStatus: "untrusted" };
  }

  if (validationStatus !== "valid") {
    return { parsed: null, parseStatus: "absent" };
  }

  const parsed = safeParseRepoIntelligence(raw);
  if (parsed.ok) {
    return { parsed: parsed.value, parseStatus: "ok" };
  }

  return { parsed: null, parseStatus: "invalid" };
}

/**
 * Consumer-agnostic scan intelligence — structured facts only (no UI copy).
 */
export function deriveScanNarrative(
  result: ScanResult | null | undefined,
): ScanNarrativeFacts {
  if (!result) {
    return { ...EMPTY_SCAN_NARRATIVE_FACTS };
  }

  const changedPackages = changedPackagesFromAssessment(result);
  const mergePosture =
    mergePostureFromDecision(result.decision?.recommendation) ?? null;
  const riskIndex =
    typeof result.totalScore === "number" && Number.isFinite(result.totalScore)
      ? result.totalScore
      : null;

  const codeIntelligenceAvailable =
    result.analysisPreparation?.codeIntelligenceAvailable !== false;

  const { parsed: parsedRi, parseStatus: repoIntelligenceParse } =
    resolveTrustedRepoIntelligence(result);
  const corpusGate =
    codeIntelligenceAvailable &&
    repoIntelligenceParse === "ok" &&
    parsedRi != null;

  let tier1Blocks = emptyTier1Blocks();

  if (corpusGate && parsedRi) {
    tier1Blocks = extractTier1FromRepoIntelligence(parsedRi, changedPackages);
  } else if (changedPackages.all.length > 0) {
    tier1Blocks = {
      ...emptyTier1Blocks(),
      blastRadius: blastRadiusFromChangedCount(changedPackages.all.length),
    };
  }

  tier1Blocks.hotspots = mergeGraphHotspots(
    tier1Blocks.hotspots,
    result.graphInsights?.hotspots,
  );

  const tier1 = corpusGate && hasMeaningfulTier1(tier1Blocks);
  const reviewerGuidance = collectReviewerGuidance(result);
  const tier2 = reviewerGuidance.some(
    (g) => g.scope === "changed" || g.kind === "insight",
  );
  const repositoryContext = extractRepositoryContextFacts(result);
  const tier3 = repositoryContext.length > 0;

  const mode = resolveAvailabilityMode(
    tier1,
    tier2 || reviewerGuidance.length > 0,
    codeIntelligenceAvailable,
  );

  const decisionConf = result.decision?.confidence;
  const confidence = {
    decision:
      decisionConf === "low" ||
      decisionConf === "medium" ||
      decisionConf === "high"
        ? decisionConf
        : null,
  };

  if (!tier1 && mode === "graph_fallback" && changedPackages.all.length > 0) {
    tier1Blocks.blastRadius = blastRadiusFromChangedCount(
      changedPackages.all.length,
    );
  }

  let affectedAreas = tier1Blocks.affectedAreas;
  if (affectedAreas.length === 0 && mode !== "pr_intelligence") {
    affectedAreas = selectTopAffectedAreas(result, { max: 2 }).map((label) => ({
      id: label.toLowerCase().replace(/\s+/g, "_").slice(0, 48),
      label,
    }));
  }

  return {
    availability: {
      mode,
      codeIntelligenceAvailable,
      tiersPresent: {
        tier1,
        tier2: reviewerGuidance.length > 0,
        tier3,
      },
      repoIntelligenceParse,
    },
    changedPackages,
    packageUsage: tier1Blocks.packageUsage,
    frameworks: tier1Blocks.frameworks,
    runtimeSurface: tier1Blocks.runtimeSurface,
    reachability: tier1Blocks.reachability,
    packageSemantics: tier1Blocks.packageSemantics,
    changedPackageSemantics: tier1Blocks.changedPackageSemantics,
    blastRadius: tier1Blocks.blastRadius,
    affectedAreas,
    hotspots: tier1Blocks.hotspots,
    reviewerGuidance,
    confidence,
    repositoryContext,
    mergePosture,
    riskIndex,
  };
}
