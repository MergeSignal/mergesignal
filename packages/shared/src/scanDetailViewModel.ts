import {
  humanizeEngineSurfaceText,
  layerRiskBandLabel,
  sortPRInsightsForDisplay,
  truncateWithEllipsis,
} from "./actionsStepSummary.js";
import {
  mapFindingToCatalogPhrase,
  mapGraphInsightsToCatalogPhrases,
  phraseForFamily,
  type CatalogPhrase,
} from "./cardObservationCatalog.js";
import { deriveScanNarrative } from "./deriveScanNarrative.js";
import { formatCardAreaLabels } from "./formatCardAreaLabels.js";
import {
  composeContextLineFromFacts,
  formatChangedPackagesShort,
  formatUsageSummaryLine,
  labelBlastRadiusLevel,
  labelReachabilityKind,
  labelRuntimeSurface,
  summarizeBlastRadius,
} from "./narrativePresentation.js";
import {
  normalizeGeneratedText,
  normalizeGeneratedTextNullable,
} from "./normalizeGeneratedText.js";
import type { ScanNarrativeFacts } from "./scanNarrativeFacts.js";
import { deriveCardOperationalObservations } from "./deriveCardOperationalObservations.js";
import {
  deriveScanDetailRecommendations,
  recommendationTitlesForDedupe,
  type ScanDetailRecommendationCenter,
} from "./deriveScanDetailRecommendations.js";
import {
  deriveSignalSummary,
  type ScanDetailSignalSummary,
} from "./deriveRiskScoreSummary.js";
import {
  deriveCardExposureDisplay,
  deriveDetailReachChip,
  type CardExposureCategory,
} from "./formatCardExposureDisplay.js";
import { formatInsight } from "./formatInsight.js";
import {
  mergePostureFromDecision,
  type MergePosture,
} from "./riskVocabulary.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import type {
  DependencyGraphInsight,
  Finding,
  FindingSeverity,
  PRInsight,
  Recommendation,
  ScanResult,
  ScoreLayer,
} from "./types.js";

export const ACT2_MAX_THEMES = 4;
export const ACT2_MAX_THEME_CHARS = 80;
export const VERDICT_LINE_MAX_CHARS = 120;
export const TIER1_MAX_VISIBLE_IMPACTS = 3;
export const ACT3_EVIDENCE_COLLAPSE_THRESHOLD = 10;

const ACT2_FORBIDDEN =
  /CVE-\d|@\d|\d+\.\d+\.\d+|[a-z0-9@./+-]+\/[a-z0-9@./+-]+/i;

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const LAYER_ORDER: readonly ScoreLayer[] = [
  "security",
  "maintainability",
  "ecosystem",
  "upgradeImpact",
];

export type ScanDetailOperationalImpactItem = {
  message: string;
  where?: string;
  verify?: string;
  affectedFiles?: string[];
};

export type ScanDetailOperationalImpact = {
  status: "rich" | "fallback" | "hidden";
  items: ScanDetailOperationalImpactItem[];
  fallbackMessage?: string;
};

export type ScanDetailVerdict = {
  posture: MergePosture | null;
  scopeChip: string | null;
  verdictLine: string;
  prLabel?: string;
  statusLabel?: string;
};

export type ScanDetailAttentionPackage = {
  name: string;
  version?: string;
  direct: boolean;
  severity?: FindingSeverity;
  evidence?: string;
};

export type ScanDetailAttentionArea = {
  problemLabel: string;
  problemDescription: string;
  packages: ScanDetailAttentionPackage[];
  overflowCount: number;
};

export type ScanDetailFindingRow = {
  id: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  packageName: string;
  recommendation?: string;
  source: "dependency" | "code";
  coveredByRecommendationRank?: number;
};

export type ScanDetailTopology = {
  summaryLine: string;
  deepest: Array<{
    packageName: string;
    depth: number;
    direct: boolean;
    via: string[];
  }>;
};

export type ScanDetailNarrativeContext = {
  mode: import("./scanNarrativeFacts.js").NarrativeAvailabilityMode;
  codeIntelligenceAvailable: boolean;
  changedPackagesDisplay: string | null;
  runtimeSurfaceLabel: string | null;
  reachabilityLabel: string | null;
  blastRadiusLabel: string | null;
  affectedAreas: string[];
  structuralOnlyDisclaimer: string | null;
  usageHighlights: string[];
  frameworks: string[];
  blastRadiusFactors: string[];
  hotspotNames: string[];
  usageContextLine: string | null;
  upgradeContextLine: string | null;
};

export type ScanDetailViewModel = {
  verdict: ScanDetailVerdict;
  signalSummary: ScanDetailSignalSummary | null;
  followUpBridgeNote: string | null;
  recommendedActions: ScanDetailRecommendationCenter;
  operationalImpact: ScanDetailOperationalImpact;
  because: { themes: string[]; confidenceCaveat?: string } | null;
  evidence: {
    attentionAreas: ScanDetailAttentionArea[];
    findings: ScanDetailFindingRow[];
    findingsOverflowCount: number;
    topology: ScanDetailTopology | null;
  } | null;
  repoContext:
    | { status: "hidden" }
    | { status: "loaded"; comparisonLine: string };
  narrativeContext: ScanDetailNarrativeContext;
  metadata: {
    scanId: string;
    generatedAt?: string;
    methodologyVersion?: string | null;
    changedPackagesSummary?: string;
    codeAnalysisTimedOut?: boolean;
    codeIntelligenceAvailable?: boolean;
  };
};

export type DeriveScanDetailOptions = {
  scanId: string;
  status: "queued" | "running" | "done" | "failed";
  methodologyVersion?: string | null;
  prNumber?: number | null;
  repoContext?: ScanDetailViewModel["repoContext"];
};

/** Bridge copy from Signal summary to Recommended actions. */
export function deriveFollowUpBridgeNote(actionCount: number): string | null {
  if (actionCount <= 0) return null;
  const copy = scanSurfaceCopy.scanDetail.signalSummary;
  if (actionCount === 1) return copy.followUpImprovementIdentified;
  return copy.followUpImprovementsIdentified.replace(
    "{count}",
    String(actionCount),
  );
}

/** Act 2 theme sanitizer — strips package/CVE/version content. */
export function sanitizeAct2Theme(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || ACT2_FORBIDDEN.test(trimmed)) return null;
  return truncateWithEllipsis(trimmed, ACT2_MAX_THEME_CHARS);
}

function reachBand(
  category: CardExposureCategory | undefined,
): "narrow" | "moderate" | "wide" {
  if (!category || category === "minimal" || category === "limited")
    return "narrow";
  if (category === "moderate") return "moderate";
  return "wide";
}

/** Verdict line from posture + reach band (scanSurfaceCopy.scanDetail.verdictLine). */
export function deriveVerdictLine(
  posture: MergePosture | null,
  totalScore: number | null | undefined,
): string {
  const copy = scanSurfaceCopy.scanDetail.verdictLine;
  const category = deriveCardExposureDisplay(totalScore)?.category;
  const band = reachBand(category);

  if (posture === "safe") {
    if (band === "wide") return copy.safeNoBlockersWide;
    if (band === "moderate") return copy.safeNoBlockersModerate;
    return copy.safeNoBlockersNarrow;
  }
  if (posture === "risky") {
    if (band === "wide") return copy.riskyResolveWide;
    if (band === "moderate") return copy.riskyResolveModerate;
    return copy.riskyResolveNarrow;
  }
  if (posture === "needs_review") {
    if (band === "wide") return copy.reviewBeforeMergeWide;
    if (band === "moderate") return copy.reviewBeforeMergeModerate;
    return copy.reviewBeforeMergeNarrow;
  }
  return scanSurfaceCopy.pipeline.scanIncomplete;
}

function themeFromCatalogPhrase(phrase: CatalogPhrase): string {
  const map: Partial<Record<CatalogPhrase, string>> = {
    "Vulnerable transitive packages detected":
      "Known vulnerabilities in the transitive tree",
    "Transitive dependency hotspots detected":
      "Shared packages concentrate dependency risk",
    "Duplicate dependency versions detected":
      "Overlapping dependency paths detected",
    "Large upgrade blast radius": "Large upgrade footprint across the graph",
    "High transitive dependency volume":
      "High transitive dependency volume in the graph",
    "Deep indirect dependency chains": "Deep indirect dependency chains",
    "Broad package surface area": "Broad declared package footprint",
    "Stale ecosystem dependencies detected":
      "Stale ecosystem dependencies detected",
    "Overlapping dependency paths detected":
      "Overlapping dependency paths detected",
  };
  return map[phrase] ?? phrase;
}

function collectAct2ThemeCandidates(result: ScanResult): string[] {
  const candidates: string[] = [];
  const posture = mergePostureFromDecision(result.decision?.recommendation);

  const observations = deriveCardOperationalObservations(result, {
    mergePosture: posture,
    hasFullResult: true,
    max: ACT2_MAX_THEMES + 2,
  });
  for (const phrase of observations.operationalObservations) {
    candidates.push(themeFromCatalogPhrase(phrase));
  }

  for (const phrase of mapGraphInsightsToCatalogPhrases(result.graphInsights)) {
    candidates.push(themeFromCatalogPhrase(phrase.phrase));
  }

  if (Array.isArray(result.decision?.reasoning)) {
    for (const reason of result.decision.reasoning) {
      const humanized = humanizeEngineSurfaceText(reason);
      if (humanized) candidates.push(humanized);
    }
  }

  for (const layer of LAYER_ORDER) {
    const layerScore = result.layerScores?.[layer];
    const band = layerRiskBandLabel(layerScore);
    if (band !== "Moderate" && band !== "High") continue;
    const drivers = humanizeEngineSurfaceText(
      `${layer} ${band.toLowerCase()} contribution`,
    );
    if (drivers) candidates.push(`${layer} dimension elevated`);
  }

  return candidates;
}

export function deriveAct2Themes(result: ScanResult): string[] {
  const seen = new Set<string>();
  const themes: string[] = [];
  for (const candidate of collectAct2ThemeCandidates(result)) {
    const sanitized = sanitizeAct2Theme(candidate);
    if (!sanitized) continue;
    const key = sanitized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    themes.push(sanitized);
    if (themes.length >= ACT2_MAX_THEMES) break;
  }
  return themes;
}

function insightToImpactItem(
  insight: PRInsight,
  verifyLabels: Set<string>,
): ScanDetailOperationalImpactItem {
  const formatted = formatInsight(insight);
  const verify =
    formatted.action &&
    !verifyLabels.has(
      formatted.action.toLowerCase().replace(/\s+/g, " ").trim(),
    )
      ? formatted.action
      : undefined;
  return {
    message: formatted.message,
    where: formatted.where ?? undefined,
    verify,
    affectedFiles: insight.affectedFiles?.length
      ? insight.affectedFiles
      : undefined,
  };
}

export function deriveOperationalImpact(
  result: ScanResult,
  verifyLabels: Set<string> = new Set(),
): ScanDetailOperationalImpact {
  const insights = sortPRInsightsForDisplay(
    Array.isArray(result.insights) ? result.insights : [],
  );
  const copy = scanSurfaceCopy.scanDetail.tier1Fallback;
  const posture = mergePostureFromDecision(result.decision?.recommendation);
  const reachCategory = deriveCardExposureDisplay(result.totalScore)?.category;

  if (insights.length > 0) {
    return {
      status: "rich",
      items: insights.map((insight) =>
        insightToImpactItem(insight, verifyLabels),
      ),
    };
  }

  const isQuietSafe =
    posture === "safe" &&
    (reachCategory === "minimal" || reachCategory === "limited");

  if (result.reportPresentation?.mode === "lightweight_pr_graph_baseline") {
    return {
      status: "fallback",
      items: [],
      fallbackMessage: copy.lightweightPr,
    };
  }

  const hasGraphProof =
    (result.graphInsights?.vulnerable?.length ?? 0) > 0 ||
    (result.graphInsights?.hotspots?.length ?? 0) > 0 ||
    (result.findings?.length ?? 0) > 0;

  if (hasGraphProof && posture !== "safe") {
    return {
      status: "fallback",
      items: [],
      fallbackMessage: copy.structuralProofBelow,
    };
  }

  if (isQuietSafe) {
    return {
      status: "fallback",
      items: [],
      fallbackMessage: copy.quietSafe,
    };
  }

  return {
    status: "fallback",
    items: [],
    fallbackMessage: copy.structuralComplete,
  };
}

function graphInsightToPackage(
  item: DependencyGraphInsight,
  severity?: FindingSeverity,
  evidence?: string,
): ScanDetailAttentionPackage {
  return {
    name: item.packageName,
    version: item.version,
    direct: item.direct,
    severity,
    evidence,
  };
}

function usageWhereFromFacts(facts: ScanNarrativeFacts): string | undefined {
  const primary = facts.changedPackages.primary;
  const row =
    facts.packageUsage.find((u) => u.packageName === primary) ??
    facts.packageUsage[0];
  if (!row) return undefined;
  const paths = [...row.paths, ...row.criticalPaths, ...row.files].filter(
    Boolean,
  );
  if (paths.length === 0 && row.areas.length > 0) {
    return row.areas.slice(0, 3).join(", ");
  }
  if (paths.length === 0) return undefined;
  const sample = paths.slice(0, 3).join(", ");
  if (paths.length > 3) {
    return `${sample} (+${paths.length - 3} more)`;
  }
  return sample;
}

function buildAttentionAreasFromFacts(
  facts: ScanNarrativeFacts,
): ScanDetailAttentionArea[] {
  const areas: ScanDetailAttentionArea[] = [];

  if (facts.hotspots.length > 0) {
    const packages = facts.hotspots.map((h) => ({
      name: h.packageName,
      direct: true,
      evidence: h.paths[0],
    }));
    areas.push({
      problemLabel: "Dependency hotspots",
      problemDescription:
        "Packages where paths converge or corpus analysis flagged critical usage.",
      packages: packages.slice(0, ACT3_EVIDENCE_COLLAPSE_THRESHOLD),
      overflowCount: Math.max(
        0,
        packages.length - ACT3_EVIDENCE_COLLAPSE_THRESHOLD,
      ),
    });
  }

  const blast = facts.blastRadius;
  if (
    blast &&
    (blast.level === "wide" || (blast.changedPackageCount ?? 0) >= 8)
  ) {
    const names = facts.changedPackages.all;
    if (names.length > 0) {
      const packages = names
        .slice(0, ACT3_EVIDENCE_COLLAPSE_THRESHOLD)
        .map((name) => ({ name, direct: true }));
      areas.push({
        problemLabel: phraseForFamily("blast_radius"),
        problemDescription:
          blast.factors.length > 0
            ? `Wide blast radius: ${blast.factors.slice(0, 3).join(", ").replace(/_/g, " ")}`
            : "Many packages changed in this upgrade.",
        packages,
        overflowCount: Math.max(
          0,
          names.length - ACT3_EVIDENCE_COLLAPSE_THRESHOLD,
        ),
      });
    }
  }

  return areas;
}

function mergeAttentionAreas(
  fromFacts: ScanDetailAttentionArea[],
  fromGraph: ScanDetailAttentionArea[],
): ScanDetailAttentionArea[] {
  if (fromFacts.length === 0) return fromGraph;
  const factPackageNames = new Set(
    fromFacts.flatMap((a) => a.packages.map((p) => p.name)),
  );

  const filteredGraph = fromGraph.filter((area) => {
    if (area.problemLabel !== phraseForFamily("transitive_hotspots")) {
      return true;
    }
    const onlyDupes = area.packages.every((p) => factPackageNames.has(p.name));
    return !onlyDupes;
  });

  return [...fromFacts, ...filteredGraph];
}

function buildAttentionAreas(result: ScanResult): ScanDetailAttentionArea[] {
  const areas: ScanDetailAttentionArea[] = [];
  const gi = result.graphInsights;

  const vulnerable = Array.isArray(gi?.vulnerable) ? gi.vulnerable : [];
  if (vulnerable.length > 0) {
    const packages = vulnerable.map((v) => graphInsightToPackage(v));
    areas.push({
      problemLabel: phraseForFamily("vulnerable_transitive"),
      problemDescription:
        "Packages with known security advisories in the dependency tree.",
      packages: packages.slice(0, ACT3_EVIDENCE_COLLAPSE_THRESHOLD),
      overflowCount: Math.max(
        0,
        packages.length - ACT3_EVIDENCE_COLLAPSE_THRESHOLD,
      ),
    });
  }

  const hotspots = Array.isArray(gi?.hotspots) ? gi.hotspots : [];
  if (hotspots.length > 0) {
    const packages = hotspots.map((h) => graphInsightToPackage(h));
    areas.push({
      problemLabel: phraseForFamily("transitive_hotspots"),
      problemDescription: "Packages many dependency paths converge on.",
      packages: packages.slice(0, ACT3_EVIDENCE_COLLAPSE_THRESHOLD),
      overflowCount: Math.max(
        0,
        packages.length - ACT3_EVIDENCE_COLLAPSE_THRESHOLD,
      ),
    });
  }

  const findings = Array.isArray(result.findings) ? result.findings : [];
  const duplicateFindings = findings.filter((f) => {
    const mapped = mapFindingToCatalogPhrase(f);
    return mapped?.family === "duplicate_versions";
  });
  if (duplicateFindings.length > 0) {
    const packages = duplicateFindings.map((f) => ({
      name: f.packageName,
      direct: true,
      severity: f.severity,
    }));
    areas.push({
      problemLabel: phraseForFamily("duplicate_versions"),
      problemDescription: "Multiple resolved versions of the same dependency.",
      packages: packages.slice(0, ACT3_EVIDENCE_COLLAPSE_THRESHOLD),
      overflowCount: Math.max(
        0,
        packages.length - ACT3_EVIDENCE_COLLAPSE_THRESHOLD,
      ),
    });
  }

  const changed = Array.isArray(result.changedPackages)
    ? result.changedPackages
    : [];
  if (changed.length >= 8) {
    const packages = changed
      .slice(0, ACT3_EVIDENCE_COLLAPSE_THRESHOLD)
      .map((name) => ({
        name,
        direct: true,
      }));
    areas.push({
      problemLabel: phraseForFamily("blast_radius"),
      problemDescription: "Many packages changed in this upgrade.",
      packages,
      overflowCount: Math.max(
        0,
        changed.length - ACT3_EVIDENCE_COLLAPSE_THRESHOLD,
      ),
    });
  }

  return areas;
}

function findingToRow(
  f: Finding,
  source: "dependency" | "code",
): ScanDetailFindingRow {
  return {
    id: f.id,
    severity: f.severity,
    title: f.title,
    description: f.description,
    packageName: f.packageName,
    recommendation: f.recommendation,
    source,
  };
}

function sortFindings(
  findings: ScanDetailFindingRow[],
): ScanDetailFindingRow[] {
  return [...findings].sort((a, b) => {
    const sd = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (sd !== 0) return sd;
    return a.packageName.localeCompare(b.packageName);
  });
}

function buildFindingRows(result: ScanResult): ScanDetailFindingRow[] {
  const rows: ScanDetailFindingRow[] = [];
  for (const f of Array.isArray(result.findings) ? result.findings : []) {
    rows.push(findingToRow(f, "dependency"));
  }
  return sortFindings(rows);
}

function buildTopology(result: ScanResult): ScanDetailTopology | null {
  const gi = result.graphInsights;
  if (!gi) return null;
  const nodes = typeof gi.nodes === "number" ? gi.nodes : 0;
  const edges = typeof gi.edges === "number" ? gi.edges : 0;
  const maxDepth = typeof gi.maxDepth === "number" ? gi.maxDepth : 0;
  if (nodes === 0 && edges === 0 && maxDepth === 0) return null;

  const deepest = Array.isArray(gi.deepest)
    ? gi.deepest.slice(0, 5).map((d) => ({
        packageName: d.packageName,
        depth: d.depth,
        direct: d.direct,
        via: Array.isArray(d.via) ? d.via : [],
      }))
    : [];

  return {
    summaryLine: normalizeGeneratedText(
      `${nodes} packages | ${edges} edges | max depth ${maxDepth}`,
    ),
    deepest,
  };
}

function annotateFindingsWithCoverage(
  rows: ScanDetailFindingRow[],
  center: ScanDetailRecommendationCenter,
): ScanDetailFindingRow[] {
  const rankByFindingId = new Map<string, number>();
  for (const item of center.items) {
    for (const findingId of item.proofRefs?.findingIds ?? []) {
      if (!rankByFindingId.has(findingId)) {
        rankByFindingId.set(findingId, item.rank);
      }
    }
  }

  return rows.map((row) => {
    const rank = rankByFindingId.get(row.id);
    if (!rank) return row;
    return {
      ...row,
      recommendation: undefined,
      coveredByRecommendationRank: rank,
    };
  });
}

function deriveConfidenceCaveat(result: ScanResult): string | undefined {
  const confidence = result.decision?.confidence;
  if (confidence === "medium") {
    return scanSurfaceCopy.scanDetail.confidenceCaveat.medium;
  }
  if (confidence === "low") {
    return scanSurfaceCopy.scanDetail.confidenceCaveat.low;
  }
  return undefined;
}

export function presentScanDetailNarrativeContext(
  facts: ScanNarrativeFacts,
): ScanDetailNarrativeContext {
  const affectedAreas: string[] = [];
  for (const area of facts.affectedAreas) {
    const formatted = formatCardAreaLabels([area.label], 1);
    if (formatted[0]) affectedAreas.push(formatted[0]);
    if (affectedAreas.length >= 4) break;
  }

  const usageHighlights: string[] = [];
  for (const row of facts.packageUsage.slice(0, 4)) {
    const paths = [...row.paths, ...row.criticalPaths, ...row.files];
    if (paths[0]) usageHighlights.push(paths[0]);
  }

  const blast = summarizeBlastRadius(facts, 5);

  return {
    mode: facts.availability.mode,
    codeIntelligenceAvailable: facts.availability.codeIntelligenceAvailable,
    changedPackagesDisplay: formatChangedPackagesShort(facts, 4),
    runtimeSurfaceLabel: labelRuntimeSurface(facts),
    reachabilityLabel: labelReachabilityKind(facts),
    blastRadiusLabel: labelBlastRadiusLevel(facts),
    affectedAreas,
    structuralOnlyDisclaimer:
      facts.availability.mode === "graph_fallback" &&
      !facts.availability.tiersPresent.tier1
        ? scanSurfaceCopy.narrativeCard.structuralOnlyDisclaimer
        : null,
    usageHighlights: usageHighlights.slice(0, 5),
    frameworks: facts.frameworks.slice(0, 5),
    blastRadiusFactors: blast.factors.map((f) => f.replace(/_/g, " ")),
    hotspotNames: facts.hotspots.map((h) => h.packageName).slice(0, 8),
    usageContextLine: normalizeGeneratedTextNullable(
      formatUsageSummaryLine(facts, 2),
    ),
    upgradeContextLine: normalizeGeneratedTextNullable(
      composeContextLineFromFacts(facts, {
        includePathSample: true,
        maxAreas: 4,
      }),
    ),
  };
}

function narrativeContextFromFacts(
  facts: ScanNarrativeFacts,
): ScanDetailNarrativeContext {
  return presentScanDetailNarrativeContext(facts);
}

function guidanceToImpactItem(
  g: ScanNarrativeFacts["reviewerGuidance"][number],
  verifyLabels: Set<string>,
  facts?: ScanNarrativeFacts,
): ScanDetailOperationalImpactItem {
  const verify =
    g.remediation &&
    !verifyLabels.has(g.remediation.toLowerCase().replace(/\s+/g, " ").trim())
      ? g.remediation
      : undefined;

  let where = g.context?.trim() || undefined;
  if (
    !where &&
    facts &&
    (facts.availability.mode === "pr_intelligence" ||
      facts.availability.tiersPresent.tier1)
  ) {
    where = usageWhereFromFacts(facts);
  }

  return {
    message: normalizeGeneratedText(g.message),
    where: where ? normalizeGeneratedText(where) : undefined,
    verify: verify ? normalizeGeneratedText(verify) : undefined,
    affectedFiles: g.affectedFiles,
  };
}

function deriveOperationalImpactFromFacts(
  facts: ScanNarrativeFacts,
  result: ScanResult,
  verifyLabels: Set<string>,
): ScanDetailOperationalImpact {
  const changedGuidance = facts.reviewerGuidance.filter(
    (g) => g.scope === "changed" || g.kind === "insight",
  );

  if (
    facts.availability.mode === "pr_intelligence" ||
    (facts.availability.tiersPresent.tier1 && changedGuidance.length > 0)
  ) {
    const items = changedGuidance
      .slice(0, 6)
      .map((g) => guidanceToImpactItem(g, verifyLabels, facts));
    if (items.length > 0) {
      return { status: "rich", items };
    }
  }

  if (changedGuidance.length > 0) {
    const insightCount = Array.isArray(result.insights)
      ? result.insights.length
      : 0;
    if (insightCount > TIER1_MAX_VISIBLE_IMPACTS) {
      return deriveOperationalImpact(result, verifyLabels);
    }
    return {
      status: "rich",
      items: changedGuidance
        .slice(0, 6)
        .map((g) => guidanceToImpactItem(g, verifyLabels, facts)),
    };
  }

  return deriveOperationalImpact(result, verifyLabels);
}

function themeCandidateFromLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  return sanitizeAct2Theme(trimmed) ?? trimmed.slice(0, ACT2_MAX_THEME_CHARS);
}

function deriveBecauseThemesFromFacts(facts: ScanNarrativeFacts): string[] {
  const themes: string[] = [];
  const seen = new Set<string>();
  const prIntelligence =
    facts.availability.mode === "pr_intelligence" ||
    facts.availability.tiersPresent.tier1;

  const pushTheme = (raw: string | null) => {
    if (!raw) return;
    const normalized = normalizeGeneratedText(raw);
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    themes.push(normalized);
  };

  if (prIntelligence) {
    for (const area of facts.affectedAreas) {
      pushTheme(themeCandidateFromLabel(area.label));
      if (themes.length >= ACT2_MAX_THEMES) return themes;
    }
    for (const factor of facts.blastRadius?.factors ?? []) {
      pushTheme(themeCandidateFromLabel(factor.replace(/_/g, " ")));
      if (themes.length >= ACT2_MAX_THEMES) return themes;
    }
    const reachLabel = labelReachabilityKind(facts);
    if (reachLabel) pushTheme(reachLabel);
  }

  for (const g of facts.reviewerGuidance.slice(0, ACT2_MAX_THEMES + 2)) {
    pushTheme(sanitizeAct2Theme(g.message));
    if (themes.length >= ACT2_MAX_THEMES) return themes;
  }

  if (themes.length < ACT2_MAX_THEMES && !prIntelligence) {
    for (const ctx of facts.repositoryContext) {
      pushTheme(sanitizeAct2Theme(phraseForFamily(ctx.family)));
      if (themes.length >= ACT2_MAX_THEMES) break;
    }
  }

  return themes.slice(0, ACT2_MAX_THEMES);
}

export function deriveVerdictLineFromFacts(
  facts: ScanNarrativeFacts,
  result: ScanResult,
): string {
  const topGuidance = facts.reviewerGuidance.find(
    (g) => (g.scope === "changed" || g.kind === "insight") && g.message.trim(),
  );
  if (topGuidance) {
    return truncateWithEllipsis(
      topGuidance.message.trim(),
      VERDICT_LINE_MAX_CHARS,
    );
  }
  const posture = mergePostureFromDecision(result.decision?.recommendation);
  return truncateWithEllipsis(
    deriveVerdictLine(posture, result.totalScore),
    VERDICT_LINE_MAX_CHARS,
  );
}

/** Scan detail presentation from shared narrative facts. */
export function presentScanDetailViewModel(
  facts: ScanNarrativeFacts,
  result: ScanResult,
  options: DeriveScanDetailOptions,
): ScanDetailViewModel {
  const posture = mergePostureFromDecision(result.decision?.recommendation);
  const scopeChip = deriveDetailReachChip(result.totalScore);
  const verdictLine = deriveVerdictLineFromFacts(facts, result);
  const narrativeContext = narrativeContextFromFacts(facts);

  const recommendedActions = deriveScanDetailRecommendations(result);
  const signalSummary = deriveSignalSummary(result);
  const verifyLabels = recommendationTitlesForDedupe(recommendedActions);
  const operationalImpact = deriveOperationalImpactFromFacts(
    facts,
    result,
    verifyLabels,
  );

  const themes = deriveBecauseThemesFromFacts(facts);
  const confidenceCaveat = deriveConfidenceCaveat(result);
  const because =
    themes.length > 0 || confidenceCaveat ? { themes, confidenceCaveat } : null;

  const factsAttention =
    facts.availability.mode === "pr_intelligence" ||
    facts.availability.tiersPresent.tier1
      ? buildAttentionAreasFromFacts(facts)
      : [];
  const attentionAreas = mergeAttentionAreas(
    factsAttention,
    buildAttentionAreas(result),
  );
  const allFindings = annotateFindingsWithCoverage(
    buildFindingRows(result),
    recommendedActions,
  );
  const topology = buildTopology(result);

  const hasEvidence =
    attentionAreas.length > 0 || allFindings.length > 0 || topology != null;

  return {
    verdict: {
      posture,
      scopeChip,
      verdictLine,
      prLabel: options.prNumber != null ? `#${options.prNumber}` : undefined,
    },
    signalSummary,
    followUpBridgeNote: deriveFollowUpBridgeNote(
      recommendedActions.items.length,
    ),
    recommendedActions,
    operationalImpact,
    because,
    evidence: hasEvidence
      ? {
          attentionAreas,
          findings: allFindings,
          findingsOverflowCount: Math.max(
            0,
            allFindings.length - ACT3_EVIDENCE_COLLAPSE_THRESHOLD,
          ),
          topology,
        }
      : null,
    repoContext: options.repoContext ?? { status: "hidden" },
    narrativeContext,
    metadata: {
      scanId: options.scanId,
      generatedAt: result.generatedAt,
      methodologyVersion: options.methodologyVersion,
      changedPackagesSummary:
        narrativeContext.changedPackagesDisplay ??
        facts.changedPackages.primary ??
        undefined,
      codeAnalysisTimedOut: result.codeAnalysisMetrics?.timedOut === true,
      codeIntelligenceAvailable: facts.availability.codeIntelligenceAvailable,
    },
  };
}

export function deriveScanDetailViewModel(
  result: ScanResult | null | undefined,
  options: DeriveScanDetailOptions,
): ScanDetailViewModel | null {
  if (!result || options.status !== "done") return null;
  const facts = deriveScanNarrative(result);
  return presentScanDetailViewModel(facts, result, options);
}

/** Tier 1 recall test helper — true when message describes application-level impact. */
export function tier1PassesRecallTest(
  operationalImpact: ScanDetailOperationalImpact,
): boolean {
  if (operationalImpact.status === "rich") {
    return operationalImpact.items.some(
      (item) => item.message.trim().length > 10,
    );
  }
  if (
    operationalImpact.status === "fallback" &&
    operationalImpact.fallbackMessage
  ) {
    return (
      operationalImpact.fallbackMessage.includes("Dependency") ||
      operationalImpact.fallbackMessage.includes("runtime") ||
      operationalImpact.fallbackMessage.includes("application")
    );
  }
  return false;
}
