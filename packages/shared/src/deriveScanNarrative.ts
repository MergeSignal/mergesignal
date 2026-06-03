import { extractRepositoryContextFacts } from "./extractRepositoryContextFacts.js";
import {
  normalizeReachabilityKind,
  normalizeRuntimeSurfaceKind,
  parseRepoIntelligence,
  readBlastLevel,
  readReachabilityFromLoose,
  readSurfaceFromLoose,
  type RepoIntelligence,
} from "./repoIntelligenceSchema.js";
import {
  EMPTY_SCAN_NARRATIVE_FACTS,
  type BlastRadiusLevel,
  type NarrativeAvailabilityMode,
  type ReachabilityKind,
  type ReviewerGuidanceKind,
  type ReviewerGuidanceScope,
  type RuntimeSurfaceKind,
  type ScanNarrativeFacts,
} from "./scanNarrativeFacts.js";
import { mergePostureFromDecision } from "./riskVocabulary.js";
import { selectTopAffectedAreas } from "./selectTopAffectedAreas.js";
import type {
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

function blastLevelFromChangedCount(count: number): BlastRadiusLevel {
  if (count >= 8) return "wide";
  if (count >= 3) return "moderate";
  return "narrow";
}

function extractTier1FromRepoIntelligence(
  ri: RepoIntelligence,
  changed: ScanNarrativeFacts["changedPackages"],
): Pick<
  ScanNarrativeFacts,
  | "runtimeSurface"
  | "reachability"
  | "blastRadius"
  | "affectedAreas"
  | "hotspots"
> {
  const primary = changed.primary;
  const pkgIntel =
    primary && ri.packages?.[primary] ? ri.packages[primary] : undefined;

  const runtimeRaw = pkgIntel?.runtimeSurface ?? ri.runtimeSurface ?? undefined;
  const reachRaw = pkgIntel?.reachability ?? ri.reachability ?? undefined;

  const runtimeKind =
    readSurfaceFromLoose(runtimeRaw) ?? (primary ? "unknown" : null);
  const reachKind = readReachabilityFromLoose(reachRaw);

  const usageEntry =
    pkgIntel?.usage ??
    pkgIntel?.packageUsage ??
    ri.packageUsage?.find(
      (u) =>
        (u.packageName ?? u.package) === primary ||
        changed.all.includes(u.packageName ?? u.package ?? ""),
    );

  const paths = [
    ...(usageEntry?.paths ?? []),
    ...(usageEntry?.criticalPaths ?? []),
    ...(usageEntry?.files ?? []),
  ].filter(Boolean);

  const runtimeSurface =
    runtimeKind != null
      ? {
          kind: runtimeKind,
          evidence: {
            packages: primary ? [primary] : changed.all.slice(0, 3),
            paths: paths.length > 0 ? paths.slice(0, 8) : undefined,
          },
        }
      : null;

  const reachability = reachKind
    ? {
        kind: reachKind,
        evidence: {
          paths: paths.length > 0 ? paths.slice(0, 8) : undefined,
          frameworks: ri.frameworks?.length ? ri.frameworks : undefined,
        },
      }
    : null;

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
        factors: blastFromRi?.factors,
      }
    : null;

  const areasRaw = ri.applicationAreas ?? ri.affectedAreas ?? [];
  const usageAreas = usageEntry?.areas ?? pkgIntel?.areas ?? [];
  const affectedAreas: ScanNarrativeFacts["affectedAreas"] = [];

  for (const area of areasRaw) {
    affectedAreas.push({ id: area.id, label: area.label });
  }
  for (const label of usageAreas) {
    const id = label.toLowerCase().replace(/\s+/g, "_");
    if (!affectedAreas.some((a) => a.id === id)) {
      affectedAreas.push({ id, label });
    }
  }

  const hotspots: ScanNarrativeFacts["hotspots"] = [];
  const riHotspots = ri.hotspots ?? pkgIntel?.hotspots ?? [];
  for (const h of riHotspots) {
    const name = h.packageName ?? primary;
    if (!name) continue;
    hotspots.push({
      packageName: name,
      source: h.source === "graph" ? "graph" : "code",
      depth: h.depth,
      paths: h.paths,
    });
  }

  return {
    runtimeSurface,
    reachability,
    blastRadius,
    affectedAreas: affectedAreas.slice(0, 6),
    hotspots: hotspots.slice(0, 8),
  };
}

function hasMeaningfulTier1(
  tier1: Pick<
    ScanNarrativeFacts,
    | "runtimeSurface"
    | "reachability"
    | "blastRadius"
    | "affectedAreas"
    | "hotspots"
  >,
): boolean {
  return (
    tier1.runtimeSurface != null ||
    tier1.reachability != null ||
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

/**
 * Consumer-agnostic scan intelligence — structured facts only (no UI copy).
 */
export function deriveScanNarrative(
  result: ScanResult | null | undefined,
): ScanNarrativeFacts {
  if (!result) {
    return { ...EMPTY_SCAN_NARRATIVE_FACTS };
  }

  const changedPackages = parseChangedPackages(result.changedPackages);
  const mergePosture =
    mergePostureFromDecision(result.decision?.recommendation) ?? null;
  const riskIndex =
    typeof result.totalScore === "number" && Number.isFinite(result.totalScore)
      ? result.totalScore
      : null;

  const codeIntelligenceAvailable =
    result.analysisPreparation?.codeIntelligenceAvailable !== false;

  const parsedRi = parseRepoIntelligence(result.repoIntelligence);
  const corpusGate = codeIntelligenceAvailable && parsedRi != null;

  let tier1Blocks: Pick<
    ScanNarrativeFacts,
    | "runtimeSurface"
    | "reachability"
    | "blastRadius"
    | "affectedAreas"
    | "hotspots"
  > = {
    runtimeSurface: null,
    reachability: null,
    blastRadius: null,
    affectedAreas: [],
    hotspots: [],
  };

  if (corpusGate && parsedRi) {
    tier1Blocks = extractTier1FromRepoIntelligence(parsedRi, changedPackages);
  } else if (changedPackages.all.length > 0) {
    tier1Blocks = {
      runtimeSurface: null,
      reachability: null,
      blastRadius: {
        level: blastLevelFromChangedCount(changedPackages.all.length),
        changedPackageCount: changedPackages.all.length,
      },
      affectedAreas: [],
      hotspots: [],
    };
  }

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
    tier1Blocks.blastRadius = {
      level: blastLevelFromChangedCount(changedPackages.all.length),
      changedPackageCount: changedPackages.all.length,
    };
  }

  let affectedAreas = tier1Blocks.affectedAreas;
  if (affectedAreas.length === 0) {
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
    },
    changedPackages,
    runtimeSurface: tier1Blocks.runtimeSurface,
    reachability: tier1Blocks.reachability,
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

/** @internal Test helper — normalize loose engine strings. */
export { normalizeReachabilityKind, normalizeRuntimeSurfaceKind };
