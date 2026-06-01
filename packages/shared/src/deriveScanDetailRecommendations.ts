import {
  humanizeEngineSurfaceText,
  sortPRInsightsForDisplay,
  sortRecommendationsForDisplay,
  truncateWithEllipsis,
} from "./actionsStepSummary.js";
import {
  mapExplainReasonToCatalogPhrase,
  mapFindingToCatalogPhrase,
  mapGraphInsightsToCatalogPhrases,
  mapRecommendationToCatalogPhrase,
  phraseForFamily,
  type ObservationSignalFamily,
} from "./cardObservationCatalog.js";
import {
  deriveCardExposureDisplay,
  type CardExposureCategory,
} from "./formatCardExposureDisplay.js";
import { formatInsight } from "./formatInsight.js";
import {
  mergePostureFromDecision,
  type MergePosture,
} from "./riskVocabulary.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import type {
  Finding,
  PRInsight,
  Recommendation,
  ScanResult,
} from "./types.js";

export const RECOMMENDATION_MAX_ITEMS = 3;
export const RECOMMENDATION_MAX_TITLE_CHARS = 80;
export const RECOMMENDATION_PREFER_MAX_ON_SAFE = 2;
export const RECOMMENDATION_MAX_SIGNALS = 4;
export const RECOMMENDATION_MAX_PACKAGES = 5;

export type RecommendationPriority = "high" | "medium" | "low";
/** @deprecated Use RecommendationPriority */
export type GuidanceUrgency = RecommendationPriority;
export type GuidanceSource =
  | "insight"
  | "recommendation"
  | "signal"
  | "finding"
  | "posture_playbook";

export type ScanDetailRecommendationDetail = {
  why: string;
  whyNow: string;
  signals: string[];
  affectedPackages?: {
    names: string[];
    overflowCount: number;
  };
  expectedBenefit: string;
};

export type ScanDetailRecommendation = {
  id: string;
  rank: number;
  title: string;
  priority: RecommendationPriority;
  source: GuidanceSource;
  signalFamily?: ObservationSignalFamily | null;
  detail: ScanDetailRecommendationDetail;
  proofRefs?: { findingIds?: string[] };
};

export type ScanDetailRecommendationCenter = {
  heading: string;
  defaultSelectedId: string;
  items: ScanDetailRecommendation[];
  posture: MergePosture | null;
  scanContext?: string;
};

/** @deprecated Use ScanDetailRecommendationCenter */
export type ScanDetailWhatToDo = {
  items: Array<{
    id: string;
    label: string;
    emphasis: "primary" | "secondary";
    priority: RecommendationPriority;
    source: GuidanceSource;
  }>;
  posture: MergePosture | null;
};

const GUIDANCE_FORBIDDEN =
  /CVE-\d|@\d|\d+\.\d+\.\d+|\bgraph\.|fan[\s_-]?in\b|scoreimpact|\bfan-in\b/i;

const GENERIC_RECOMMENDATION_TITLE =
  /\b(reduce|flatten|minimize|minimise|avoid|improve|consider|optimize|optimise|review|upgrade|decrease|increase|check|verify|ensure|audit)\b.*\b(depend|transitiv|surface|depth|chain|area|footprint|overlap|duplicat|lockfile|semver|vulnerabil|supply)/i;

export const GUIDANCE_ACTION_FOR_FAMILY: Record<
  ObservationSignalFamily,
  string
> = {
  vulnerable_transitive: "Review vulnerable transitive packages",
  duplicate_versions: "Reduce duplicate dependency versions",
  transitive_hotspots: "Review dependency hotspots before merging",
  stale_ecosystem: "Monitor stale dependencies in affected areas",
  blast_radius: "Validate impact across changed packages",
  indirect_chains: "Review deep transitive paths before merge",
  transitive_volume: "Narrow dependency footprint where possible",
  package_surface: "Review broad package surface before merging",
  overlapping_paths: "Reduce overlapping dependency paths",
};

const GUIDANCE_WHY_FOR_FAMILY: Record<ObservationSignalFamily, string> = {
  duplicate_versions:
    "Multiple versions of the same dependency increase upgrade complexity and expand runtime surface area.",
  vulnerable_transitive:
    "Known vulnerabilities in transitive dependencies can reach production even when direct dependencies look safe.",
  transitive_hotspots:
    "Packages many paths depend on amplify the blast radius of any change or advisory.",
  stale_ecosystem:
    "Stale dependencies miss security patches and make future upgrades harder to predict.",
  blast_radius:
    "Large upgrade footprints increase the chance of unexpected runtime interactions.",
  indirect_chains:
    "Deep transitive chains hide behavior changes and make rollbacks harder to reason about.",
  transitive_volume:
    "High transitive volume expands the maintenance surface you inherit with this merge.",
  package_surface:
    "A broad package surface increases review burden and the chance of conflicting versions.",
  overlapping_paths:
    "Overlapping paths to the same package often indicate version skew or lockfile drift.",
};

const GUIDANCE_BENEFIT_FOR_FAMILY: Record<ObservationSignalFamily, string> = {
  duplicate_versions: "Simpler future upgrades and reduced maintenance burden.",
  vulnerable_transitive:
    "Reduced vulnerability exposure before code reaches production.",
  transitive_hotspots:
    "Lower blast radius when upstream packages change or publish advisories.",
  stale_ecosystem: "Easier dependency management on the next upgrade cycle.",
  blast_radius:
    "More predictable merges with fewer surprise runtime interactions.",
  indirect_chains: "Clearer dependency paths and easier rollback decisions.",
  transitive_volume: "Smaller runtime surface area and less transitive risk.",
  package_surface: "Easier dependency management and fewer version conflicts.",
  overlapping_paths:
    "Cleaner lockfiles and fewer semver surprises on the next upgrade.",
};

const FAMILY_PRIORITY: Record<ObservationSignalFamily, number> = {
  vulnerable_transitive: 95,
  duplicate_versions: 75,
  transitive_hotspots: 70,
  stale_ecosystem: 55,
  blast_radius: 65,
  indirect_chains: 50,
  overlapping_paths: 60,
  transitive_volume: 45,
  package_surface: 40,
};

type PlaybookKey =
  | "mergeNormally"
  | "scheduleCleanup"
  | "continueMonitoring"
  | "mergeAfterVerification"
  | "reviewBeforeMerge"
  | "reviewDependencyStructure"
  | "reviewAffectedPaths"
  | "monitorTransitiveChanges"
  | "riskyResolveBeforeMerge"
  | "riskyReviewVulnerable"
  | "riskyRerunAfterFixes"
  | "resolveCriticalBeforeMerge";

type RankedCandidate = {
  id: string;
  label: string;
  weight: number;
  family: ObservationSignalFamily | null;
  source: GuidanceSource;
  priority: RecommendationPriority;
  insight?: PRInsight;
  recommendation?: Recommendation;
  finding?: Finding;
  findings?: Finding[];
  playbookKey?: PlaybookKey;
};

function reachBand(
  category: CardExposureCategory | undefined,
): "narrow" | "moderate" | "wide" {
  if (!category || category === "minimal" || category === "limited") {
    return "narrow";
  }
  if (category === "moderate") return "moderate";
  return "wide";
}

function normalizeKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

function sanitizeDetailText(raw: string, maxChars = 220): string | null {
  const trimmed = raw.trim();
  if (!trimmed || GUIDANCE_FORBIDDEN.test(trimmed)) return null;
  if (trimmed.length < 8) return null;
  return truncateWithEllipsis(trimmed, maxChars);
}

function sanitizeGuidanceLabel(raw: string): string | null {
  return sanitizeDetailText(raw, RECOMMENDATION_MAX_TITLE_CHARS);
}

function sanitizeSignal(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || GUIDANCE_FORBIDDEN.test(trimmed)) return null;
  return truncateWithEllipsis(trimmed, 72);
}

function formatPackageList(names: string[], max = 3): string {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return "affected packages";
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  if (unique.length <= max) {
    return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
  }
  return `${unique.slice(0, max).join(", ")}, and others`;
}

function firstDecisionReason(result: ScanResult): string | null {
  const reasoning = result.decision?.reasoning;
  if (!Array.isArray(reasoning) || reasoning.length === 0) return null;
  return sanitizeDetailText(
    humanizeEngineSurfaceText(String(reasoning[0] ?? "")),
  );
}

function findingsForFamily(
  result: ScanResult,
  family: ObservationSignalFamily,
): Finding[] {
  const findings = Array.isArray(result.findings) ? result.findings : [];
  return findings.filter(
    (f) => mapFindingToCatalogPhrase(f)?.family === family,
  );
}

function packagesForFamily(
  result: ScanResult,
  family: ObservationSignalFamily | null,
  rec?: Recommendation,
): string[] {
  const names: string[] = [];
  if (rec?.packages?.length) {
    names.push(...rec.packages);
  }
  if (family) {
    for (const f of findingsForFamily(result, family)) {
      names.push(f.packageName);
    }
  }
  const gi = result.graphInsights;
  if (family === "vulnerable_transitive" && Array.isArray(gi?.vulnerable)) {
    names.push(...gi.vulnerable.map((v) => v.packageName));
  }
  if (family === "transitive_hotspots" && Array.isArray(gi?.hotspots)) {
    names.push(...gi.hotspots.map((h) => h.packageName));
  }
  if (family === "blast_radius" && Array.isArray(result.changedPackages)) {
    names.push(...result.changedPackages);
  }
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
}

function packageSummary(
  names: string[],
): ScanDetailRecommendationDetail["affectedPackages"] | undefined {
  if (names.length === 0) return undefined;
  const capped = names.slice(0, RECOMMENDATION_MAX_PACKAGES);
  return {
    names: capped,
    overflowCount: Math.max(0, names.length - capped.length),
  };
}

function signalsForFamily(
  result: ScanResult,
  family: ObservationSignalFamily,
  packages: string[],
): string[] {
  const out: string[] = [];
  const observation = phraseForFamily(family);
  out.push(observation);

  if (family === "duplicate_versions") {
    const dupFindings = findingsForFamily(result, family);
    if (dupFindings.length > 0) {
      out.push(
        `${dupFindings.length} duplicate dependency version${dupFindings.length === 1 ? "" : "s"} detected`,
      );
    }
    for (const pkg of packages.slice(0, 3)) {
      out.push(`Multiple ${pkg} versions present`);
    }
  }

  if (family === "vulnerable_transitive") {
    const vuln = result.graphInsights?.vulnerable ?? [];
    if (vuln.length > 0) {
      out.push(
        `${vuln.length} vulnerable transitive package${vuln.length === 1 ? "" : "s"} detected`,
      );
    }
    const critical = findingsForFamily(result, family).filter(
      (f) => f.severity === "critical" || f.severity === "high",
    );
    if (critical.length > 0) {
      out.push(
        `${critical.length} high-severity security finding${critical.length === 1 ? "" : "s"}`,
      );
    }
  }

  if (family === "transitive_hotspots") {
    const hotspots = result.graphInsights?.hotspots ?? [];
    if (hotspots.length > 0) {
      out.push(
        `${hotspots.length} transitive dependency hotspot${hotspots.length === 1 ? "" : "s"} detected`,
      );
    }
  }

  if (family === "indirect_chains") {
    const depth = result.graphInsights?.maxDepth;
    if (typeof depth === "number" && depth >= 5) {
      out.push(`Dependency paths reach depth ${depth}`);
    }
  }

  if (family === "blast_radius") {
    const changed = result.changedPackages?.length ?? 0;
    if (changed > 0) {
      out.push(
        `${changed} package${changed === 1 ? "" : "s"} changed in this upgrade`,
      );
    }
  }

  if (family === "transitive_volume" || family === "package_surface") {
    const nodes = result.graphInsights?.nodes;
    if (typeof nodes === "number" && nodes > 0) {
      out.push(`${nodes} packages in the reviewed dependency tree`);
    }
  }

  const seen = new Set<string>();
  return out
    .map((s) => sanitizeSignal(s))
    .filter((s): s is string => Boolean(s))
    .filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, RECOMMENDATION_MAX_SIGNALS);
}

function whyNowForFamily(
  result: ScanResult,
  family: ObservationSignalFamily,
  packages: string[],
): string {
  if (family === "duplicate_versions") {
    if (packages.length >= 2) {
      return `This scan detected multiple versions of ${formatPackageList(packages)} in the affected dependency tree.`;
    }
    return "This PR introduces additional duplicate versions of existing dependencies.";
  }
  if (family === "vulnerable_transitive") {
    if (packages.length > 0) {
      return `Known vulnerabilities are present in ${formatPackageList(packages)} reachable from this upgrade.`;
    }
    return "Known vulnerabilities are present in packages touched by this upgrade.";
  }
  if (family === "transitive_hotspots") {
    return "Dependency concentration increased in areas many runtime paths share.";
  }
  if (family === "blast_radius") {
    const changed = result.changedPackages?.length ?? 0;
    if (changed >= 8) {
      return `This upgrade changes ${changed} packages, expanding the merge footprint.`;
    }
    return "This upgrade touches enough packages to warrant validating downstream impact.";
  }
  if (family === "indirect_chains") {
    const depth = result.graphInsights?.maxDepth;
    if (typeof depth === "number" && depth >= 5) {
      return `Transitive paths in this scan reach depth ${depth}, increasing hidden coupling.`;
    }
    return "Deep indirect dependency chains were detected in this scan.";
  }
  const reason = firstDecisionReason(result);
  if (reason) return reason;
  return scanSurfaceCopy.scanDetail.recommendationDetail.defaultWhyNow;
}

function playbookDetail(
  key: PlaybookKey,
  result: ScanResult,
): Pick<
  ScanDetailRecommendationDetail,
  "why" | "whyNow" | "expectedBenefit" | "signals"
> {
  const copy = scanSurfaceCopy.scanDetail.recommendationPlaybookDetail[key];
  const reason = firstDecisionReason(result);
  return {
    why: copy.why,
    whyNow: reason ?? copy.whyNow,
    expectedBenefit: copy.expectedBenefit,
    signals: [...copy.signals],
  };
}

function enrichCandidate(
  candidate: RankedCandidate,
  result: ScanResult,
  rank: number,
): ScanDetailRecommendation {
  const family = candidate.family;
  const packages = packagesForFamily(result, family, candidate.recommendation);
  const affectedPackages = packageSummary(packages);
  const proofFindingIds = candidate.finding
    ? [candidate.finding.id]
    : (candidate.findings?.map((f) => f.id) ??
      (family ? findingsForFamily(result, family).map((f) => f.id) : []));

  if (candidate.insight) {
    const formatted = formatInsight(candidate.insight);
    const why =
      sanitizeDetailText(formatted.message) ??
      scanSurfaceCopy.scanDetail.recommendationDetail.defaultWhy;
    const whyNow =
      sanitizeDetailText(
        `${formatted.message}${formatted.where ? ` Affected area: ${formatted.where}.` : ""}`,
      ) ?? why;
    return {
      id: candidate.id,
      rank,
      title: candidate.label,
      priority: candidate.priority,
      source: candidate.source,
      signalFamily: family,
      detail: {
        why,
        whyNow,
        signals: [
          sanitizeSignal(`Runtime insight: ${formatted.message}`),
          candidate.insight.confidence === "confirmed"
            ? "Confirmed code-path signal in this PR"
            : candidate.insight.confidence === "likely"
              ? "Likely code-path signal in this PR"
              : "Directional code-path signal in this PR",
        ].filter((s): s is string => Boolean(s)),
        expectedBenefit:
          scanSurfaceCopy.scanDetail.recommendationDetail.insightBenefit,
      },
    };
  }

  if (candidate.playbookKey) {
    const playbook = playbookDetail(candidate.playbookKey, result);
    return {
      id: candidate.id,
      rank,
      title: candidate.label,
      priority: candidate.priority,
      source: candidate.source,
      signalFamily: family,
      detail: {
        why: playbook.why,
        whyNow: playbook.whyNow,
        signals: playbook.signals
          .map((s) => sanitizeSignal(s))
          .filter((s): s is string => Boolean(s)),
        affectedPackages,
        expectedBenefit: playbook.expectedBenefit,
      },
    };
  }

  if (candidate.finding) {
    const why =
      sanitizeDetailText(candidate.finding.description) ??
      sanitizeDetailText(candidate.finding.title) ??
      scanSurfaceCopy.scanDetail.recommendationDetail.defaultWhy;
    const whyNow =
      sanitizeDetailText(
        `${candidate.finding.title} affects ${candidate.finding.packageName} in this upgrade.`,
      ) ?? why;
    return {
      id: candidate.id,
      rank,
      title: candidate.label,
      priority: candidate.priority,
      source: candidate.source,
      signalFamily: family,
      proofRefs: proofFindingIds.length
        ? { findingIds: proofFindingIds }
        : undefined,
      detail: {
        why,
        whyNow,
        signals: [
          sanitizeSignal(`${candidate.finding.severity} severity finding`),
          sanitizeSignal(`Affects ${candidate.finding.packageName}`),
        ].filter((s): s is string => Boolean(s)),
        affectedPackages: packageSummary([candidate.finding.packageName]),
        expectedBenefit:
          candidate.finding.severity === "critical" ||
          candidate.finding.severity === "high"
            ? scanSurfaceCopy.scanDetail.recommendationDetail
                .securityFindingBenefit
            : scanSurfaceCopy.scanDetail.recommendationDetail.defaultBenefit,
      },
    };
  }

  if (candidate.id === "blocker:critical") {
    const critical = (
      Array.isArray(result.findings) ? result.findings : []
    ).filter((f) => f.severity === "critical" || f.severity === "high");
    return {
      id: candidate.id,
      rank,
      title: candidate.label,
      priority: candidate.priority,
      source: candidate.source,
      signalFamily: "vulnerable_transitive",
      proofRefs: { findingIds: critical.map((f) => f.id) },
      detail: {
        why: scanSurfaceCopy.scanDetail.recommendationPlaybookDetail
          .resolveCriticalBeforeMerge.why,
        whyNow:
          critical.length === 1
            ? `This scan flagged a ${critical[0]!.severity} finding on ${critical[0]!.packageName}.`
            : `This scan flagged ${critical.length} high-severity findings that block a safe merge.`,
        signals: [
          `${critical.length} high-severity finding${critical.length === 1 ? "" : "s"} detected`,
          ...critical.slice(0, 2).map((f) => sanitizeSignal(f.title)),
        ].filter((s): s is string => Boolean(s)),
        affectedPackages: packageSummary(critical.map((f) => f.packageName)),
        expectedBenefit:
          scanSurfaceCopy.scanDetail.recommendationPlaybookDetail
            .resolveCriticalBeforeMerge.expectedBenefit,
      },
    };
  }

  const resolvedFamily =
    family ??
    (candidate.recommendation
      ? (mapRecommendationToCatalogPhrase(candidate.recommendation)?.family ??
        null)
      : null);

  const why =
    (resolvedFamily
      ? GUIDANCE_WHY_FOR_FAMILY[resolvedFamily]
      : candidate.recommendation
        ? sanitizeDetailText(
            humanizeEngineSurfaceText(candidate.recommendation.rationale),
          )
        : null) ?? scanSurfaceCopy.scanDetail.recommendationDetail.defaultWhy;

  const whyNow = resolvedFamily
    ? whyNowForFamily(result, resolvedFamily, packages)
    : (firstDecisionReason(result) ??
      scanSurfaceCopy.scanDetail.recommendationDetail.defaultWhyNow);

  const signals = resolvedFamily
    ? signalsForFamily(result, resolvedFamily, packages)
    : candidate.recommendation
      ? [
          sanitizeSignal(
            humanizeEngineSurfaceText(candidate.recommendation.rationale),
          ),
        ].filter((s): s is string => Boolean(s))
      : [];

  const expectedBenefit = resolvedFamily
    ? GUIDANCE_BENEFIT_FOR_FAMILY[resolvedFamily]
    : scanSurfaceCopy.scanDetail.recommendationDetail.defaultBenefit;

  return {
    id: candidate.id,
    rank,
    title: candidate.label,
    priority: candidate.priority,
    source: candidate.source,
    signalFamily: resolvedFamily,
    proofRefs: proofFindingIds.length
      ? { findingIds: proofFindingIds }
      : undefined,
    detail: {
      why,
      whyNow,
      signals,
      affectedPackages,
      expectedBenefit,
    },
  };
}

function insightConfidenceWeight(insight: PRInsight): number {
  if (insight.confidence === "confirmed") return 92;
  if (insight.confidence === "likely") return 88;
  return 82;
}

function recommendationWeight(rec: Recommendation): number {
  let w = 78;
  if (rec.impact === "high") w += 8;
  if (rec.impact === "medium") w += 4;
  if (
    typeof rec.priorityScore === "number" &&
    Number.isFinite(rec.priorityScore)
  ) {
    w += Math.min(10, Math.floor(rec.priorityScore / 10));
  }
  return w;
}

function recommendationToLabel(rec: Recommendation): string | null {
  const title = String(rec.title ?? "").trim();
  const rationale = String(rec.rationale ?? "").trim();
  const mapped = mapRecommendationToCatalogPhrase(rec);
  if (GENERIC_RECOMMENDATION_TITLE.test(title)) {
    if (mapped) {
      return sanitizeGuidanceLabel(GUIDANCE_ACTION_FOR_FAMILY[mapped.family]);
    }
    if (rationale) {
      return sanitizeGuidanceLabel(humanizeEngineSurfaceText(rationale));
    }
  }
  const humanized = sanitizeGuidanceLabel(humanizeEngineSurfaceText(title));
  if (humanized) return humanized;
  return sanitizeGuidanceLabel(humanizeEngineSurfaceText(rationale));
}

function addCandidate(
  bucket: RankedCandidate[],
  candidate: Omit<RankedCandidate, "weight"> & { weight: number },
): void {
  const label = sanitizeGuidanceLabel(candidate.label);
  if (!label) return;
  bucket.push({ ...candidate, label });
}

function collectSignalFamilyCandidates(result: ScanResult): RankedCandidate[] {
  const out: RankedCandidate[] = [];
  const posture = mergePostureFromDecision(result.decision?.recommendation);

  for (const { family } of mapGraphInsightsToCatalogPhrases(
    result.graphInsights,
  )) {
    addCandidate(out, {
      id: `signal:${family}`,
      label: GUIDANCE_ACTION_FOR_FAMILY[family],
      weight: FAMILY_PRIORITY[family],
      family,
      source: "signal",
      priority: posture === "risky" ? "high" : "medium",
      findings: findingsForFamily(result, family),
    });
  }

  const findings = Array.isArray(result.findings) ? result.findings : [];
  for (const finding of findings) {
    const mapped = mapFindingToCatalogPhrase(finding);
    if (mapped) {
      addCandidate(out, {
        id: `finding-family:${finding.id}:${mapped.family}`,
        label: GUIDANCE_ACTION_FOR_FAMILY[mapped.family],
        weight:
          FAMILY_PRIORITY[mapped.family] +
          (finding.severity === "critical"
            ? 15
            : finding.severity === "high"
              ? 8
              : 0),
        family: mapped.family,
        source: "signal",
        priority:
          finding.severity === "critical" || finding.severity === "high"
            ? "high"
            : "medium",
        finding,
        findings: findingsForFamily(result, mapped.family),
      });
    }
  }

  const reasons = result.explain?.reasons;
  if (Array.isArray(reasons)) {
    for (const reason of reasons) {
      const mapped = mapExplainReasonToCatalogPhrase(reason);
      if (!mapped) continue;
      addCandidate(out, {
        id: `explain:${reason.id}:${mapped.family}`,
        label: GUIDANCE_ACTION_FOR_FAMILY[mapped.family],
        weight: FAMILY_PRIORITY[mapped.family] - 5,
        family: mapped.family,
        source: "signal",
        priority: "medium",
        findings: findingsForFamily(result, mapped.family),
      });
    }
  }

  for (const rec of sortRecommendationsForDisplay(
    Array.isArray(result.recommendations) ? result.recommendations : [],
  )) {
    const mapped = mapRecommendationToCatalogPhrase(rec);
    if (mapped) {
      addCandidate(out, {
        id: `rec-family:${rec.id}:${mapped.family}`,
        label: GUIDANCE_ACTION_FOR_FAMILY[mapped.family],
        weight: FAMILY_PRIORITY[mapped.family] - 3,
        family: mapped.family,
        source: "signal",
        priority: rec.impact === "high" ? "high" : "medium",
        recommendation: rec,
        findings: findingsForFamily(result, mapped.family),
      });
    }
  }

  return out;
}

function collectInsightCandidates(result: ScanResult): RankedCandidate[] {
  const out: RankedCandidate[] = [];
  for (const insight of sortPRInsightsForDisplay(
    Array.isArray(result.insights) ? result.insights : [],
  )) {
    const formatted = formatInsight(insight);
    const action = sanitizeGuidanceLabel(formatted.action);
    if (!action) continue;
    addCandidate(out, {
      id: `insight-action:${insight.type}:${action.slice(0, 24)}`,
      label: action,
      weight: insightConfidenceWeight(insight),
      family: null,
      source: "insight",
      priority:
        insight.priority === "critical" || insight.priority === "high"
          ? "high"
          : "medium",
      insight,
    });
  }
  return out;
}

function collectRecommendationCandidates(
  result: ScanResult,
): RankedCandidate[] {
  const out: RankedCandidate[] = [];
  for (const rec of sortRecommendationsForDisplay(
    Array.isArray(result.recommendations) ? result.recommendations : [],
  )) {
    const label = recommendationToLabel(rec);
    if (!label) continue;
    const family = mapRecommendationToCatalogPhrase(rec)?.family ?? null;
    addCandidate(out, {
      id: `rec:${rec.id}`,
      label,
      weight: recommendationWeight(rec),
      family,
      source: "recommendation",
      priority: rec.impact === "high" ? "high" : "medium",
      recommendation: rec,
      findings: family ? findingsForFamily(result, family) : undefined,
    });
  }
  return out;
}

function hasCriticalFindings(result: ScanResult): boolean {
  return (Array.isArray(result.findings) ? result.findings : []).some(
    (f) => f.severity === "critical" || f.severity === "high",
  );
}

function posturePlaybookCandidates(
  posture: MergePosture | null,
  reach: "narrow" | "moderate" | "wide",
  lightweightGraph: boolean,
): RankedCandidate[] {
  const copy = scanSurfaceCopy.scanDetail.guidancePlaybook;

  const item = (
    id: string,
    label: string,
    priority: RecommendationPriority,
    playbookKey: PlaybookKey,
  ): RankedCandidate => ({
    id,
    label,
    weight: 40,
    family: null,
    source: "posture_playbook",
    priority,
    playbookKey,
  });

  if (posture === "risky") {
    return [
      item(
        "playbook:risky-1",
        copy.riskyResolveBeforeMerge,
        "high",
        "riskyResolveBeforeMerge",
      ),
      item(
        "playbook:risky-2",
        copy.riskyReviewVulnerable,
        "high",
        "riskyReviewVulnerable",
      ),
      item(
        "playbook:risky-3",
        copy.riskyRerunAfterFixes,
        "medium",
        "riskyRerunAfterFixes",
      ),
    ];
  }

  if (posture === "needs_review") {
    const items = [
      item(
        "playbook:review-1",
        lightweightGraph
          ? copy.reviewDependencyStructure
          : copy.reviewBeforeMerge,
        "high",
        lightweightGraph ? "reviewDependencyStructure" : "reviewBeforeMerge",
      ),
      item(
        "playbook:review-3",
        copy.monitorTransitiveChanges,
        "low",
        "monitorTransitiveChanges",
      ),
    ];
    if (reach !== "narrow") {
      items.splice(
        1,
        0,
        item(
          "playbook:review-2",
          copy.reviewAffectedPaths,
          "medium",
          "reviewAffectedPaths",
        ),
      );
    }
    return items.slice(0, RECOMMENDATION_MAX_ITEMS);
  }

  if (reach === "narrow" || reach === "moderate") {
    return [
      item(
        "playbook:safe-narrow-1",
        copy.mergeNormally,
        "low",
        "mergeNormally",
      ),
      item(
        "playbook:safe-narrow-2",
        copy.scheduleCleanup,
        "low",
        "scheduleCleanup",
      ),
      item(
        "playbook:safe-narrow-3",
        copy.continueMonitoring,
        "low",
        "continueMonitoring",
      ),
    ];
  }

  return [
    item(
      "playbook:safe-wide-1",
      copy.mergeAfterVerification,
      "medium",
      "mergeAfterVerification",
    ),
    item(
      "playbook:safe-wide-2",
      copy.reviewAffectedPaths,
      "medium",
      "reviewAffectedPaths",
    ),
    item(
      "playbook:safe-wide-3",
      copy.scheduleCleanup,
      "low",
      "scheduleCleanup",
    ),
  ];
}

function selectCandidates(
  candidates: RankedCandidate[],
  posture: MergePosture | null,
  reach: "narrow" | "moderate" | "wide",
  lightweightGraph: boolean,
): RankedCandidate[] {
  const seenLabels = new Set<string>();
  const seenFamilies = new Set<ObservationSignalFamily>();
  const selected: RankedCandidate[] = [];
  const sorted = [...candidates].sort((a, b) => b.weight - a.weight);

  for (const c of sorted) {
    const key = normalizeKey(c.label);
    if (seenLabels.has(key)) continue;
    if (c.family && seenFamilies.has(c.family)) continue;
    seenLabels.add(key);
    if (c.family) seenFamilies.add(c.family);
    selected.push(c);
    if (selected.length >= RECOMMENDATION_MAX_ITEMS) break;
  }

  if (selected.length === 0) {
    return posturePlaybookCandidates(posture, reach, lightweightGraph);
  }

  if (
    posture === "safe" &&
    reach === "narrow" &&
    selected.length > RECOMMENDATION_PREFER_MAX_ON_SAFE &&
    sorted[0] &&
    sorted[0].weight < 70
  ) {
    return posturePlaybookCandidates(posture, reach, lightweightGraph).slice(
      0,
      RECOMMENDATION_PREFER_MAX_ON_SAFE,
    );
  }

  while (selected.length < RECOMMENDATION_MAX_ITEMS) {
    for (const p of posturePlaybookCandidates(
      posture,
      reach,
      lightweightGraph,
    )) {
      const key = normalizeKey(p.label);
      if (seenLabels.has(key)) continue;
      seenLabels.add(key);
      selected.push(p);
      if (selected.length >= RECOMMENDATION_MAX_ITEMS) break;
    }
    break;
  }

  if (posture === "risky" && !selected.some((i) => i.priority === "high")) {
    selected[0]!.priority = "high";
  }

  return selected.slice(0, RECOMMENDATION_MAX_ITEMS);
}

function deriveScanContext(
  result: ScanResult,
  posture: MergePosture | null,
  items: ScanDetailRecommendation[],
): string | undefined {
  if (items.every((i) => i.source === "posture_playbook")) {
    if (posture === "safe") {
      return scanSurfaceCopy.scanDetail.recommendationScanContext.quietSafe;
    }
    if (posture === "needs_review") {
      return scanSurfaceCopy.scanDetail.recommendationScanContext.needsReview;
    }
    if (posture === "risky") {
      return scanSurfaceCopy.scanDetail.recommendationScanContext.risky;
    }
  }
  if (result.reportPresentation?.mode === "lightweight_pr_graph_baseline") {
    return scanSurfaceCopy.scanDetail.recommendationScanContext
      .lightweightGraph;
  }
  return undefined;
}

/** Derive the scan detail recommendation center — always returns 1–3 enriched items. */
export function deriveScanDetailRecommendations(
  result: ScanResult,
): ScanDetailRecommendationCenter {
  const posture = mergePostureFromDecision(result.decision?.recommendation);
  const reach = reachBand(
    deriveCardExposureDisplay(result.totalScore)?.category,
  );
  const lightweightGraph =
    result.reportPresentation?.mode === "lightweight_pr_graph_baseline";

  const candidates: RankedCandidate[] = [];

  if (posture === "risky" && hasCriticalFindings(result)) {
    candidates.push({
      id: "blocker:critical",
      label:
        scanSurfaceCopy.scanDetail.guidancePlaybook.resolveCriticalBeforeMerge,
      weight: 120,
      family: "vulnerable_transitive",
      source: "signal",
      priority: "high",
      findings: (Array.isArray(result.findings) ? result.findings : []).filter(
        (f) => f.severity === "critical" || f.severity === "high",
      ),
    });
  }

  candidates.push(...collectInsightCandidates(result));
  candidates.push(...collectRecommendationCandidates(result));
  candidates.push(...collectSignalFamilyCandidates(result));

  const selected = selectCandidates(
    candidates,
    posture,
    reach,
    lightweightGraph,
  );

  const items = selected.map((candidate, index) =>
    enrichCandidate(candidate, result, index + 1),
  );

  return {
    heading: scanSurfaceCopy.scanDetail.recommendedActionsHeading,
    defaultSelectedId: items[0]?.id ?? "",
    items,
    posture,
    scanContext: deriveScanContext(result, posture, items),
  };
}

export function recommendationTitlesForDedupe(
  center: ScanDetailRecommendationCenter,
): Set<string> {
  return new Set(center.items.map((i) => normalizeKey(i.title)));
}

export function findingIdsCoveredByRecommendations(
  center: ScanDetailRecommendationCenter,
): Set<string> {
  const ids = new Set<string>();
  for (const item of center.items) {
    for (const id of item.proofRefs?.findingIds ?? []) {
      ids.add(id);
    }
  }
  return ids;
}

export function verifyLabelsForDedupe(
  center: ScanDetailRecommendationCenter,
): Set<string> {
  return recommendationTitlesForDedupe(center);
}

/** @deprecated Use deriveScanDetailRecommendations */
export function deriveScanDetailGuidance(
  result: ScanResult,
): ScanDetailWhatToDo {
  const center = deriveScanDetailRecommendations(result);
  return {
    posture: center.posture,
    items: center.items.map((item, index) => ({
      id: item.id,
      label: item.title,
      emphasis: index === 0 ? "primary" : "secondary",
      priority: item.priority,
      source: item.source,
    })),
  };
}

/** @deprecated Use recommendationTitlesForDedupe */
export function guidanceLabelsForDedupe(
  whatToDo: ScanDetailWhatToDo,
): Set<string> {
  return new Set(whatToDo.items.map((i) => normalizeKey(i.label)));
}
