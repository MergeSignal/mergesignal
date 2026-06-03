import {
  phraseForFamily,
  type CatalogPhrase,
} from "./cardObservationCatalog.js";
import {
  aggregateFindingCounts,
  deriveRiskIndexBand,
  type FindingCountSummary,
  type ScanCardSummary,
  type ScanPipelineStatus,
} from "./scanCardSummary.js";
import type { ScanNarrativeFacts } from "./scanNarrativeFacts.js";
import {
  deriveCardExposureDisplay,
  type CardExposureDisplay,
} from "./formatCardExposureDisplay.js";
import { formatCardAreaLabels } from "./formatCardAreaLabels.js";
import { MERGE_POSTURE_LABEL, type MergePosture } from "./riskVocabulary.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import type { ScanResult } from "./types.js";

export type PresentScanCardSummaryOptions = {
  pipelineStatus?: ScanPipelineStatus;
  findings?: ScanResult["findings"];
};

function formatChangedPackagesDisplay(
  facts: ScanNarrativeFacts,
): string | null {
  const { primary, others } = facts.changedPackages;
  if (!primary) return null;
  if (others.length === 0) return primary;
  return `${primary} +${others.length}`;
}

function labelRuntimeSurface(facts: ScanNarrativeFacts): string | null {
  const rs = facts.runtimeSurface;
  if (!rs) return null;
  return scanSurfaceCopy.narrativeCard.runtimeSurface[rs.kind];
}

function labelReachability(facts: ScanNarrativeFacts): string | null {
  const r = facts.reachability;
  if (!r) return null;
  return scanSurfaceCopy.narrativeCard.reachability[r.kind];
}

function labelBlastRadius(facts: ScanNarrativeFacts): string | null {
  const br = facts.blastRadius;
  if (!br) return null;
  return scanSurfaceCopy.narrativeCard.blastRadius[br.level];
}

function formatAffectedAreaLabels(facts: ScanNarrativeFacts): string[] {
  const ordered: string[] = [];
  for (const area of facts.affectedAreas) {
    const formatted = formatCardAreaLabels([area.label], 1);
    if (formatted[0]) ordered.push(formatted[0]);
    if (ordered.length >= 2) break;
  }
  return ordered;
}

function selectPrimaryInsight(facts: ScanNarrativeFacts): string | null {
  const changedGuidance = facts.reviewerGuidance.find(
    (g) => g.scope === "changed" && g.message.trim(),
  );
  if (changedGuidance) return changedGuidance.message.trim();

  const insight = facts.reviewerGuidance.find(
    (g) => g.kind === "insight" && g.message.trim(),
  );
  if (insight) return insight.message.trim();

  return null;
}

function selectSecondaryLines(
  facts: ScanNarrativeFacts,
  exclude: string | null,
): string[] {
  const lines: string[] = [];
  for (const g of facts.reviewerGuidance) {
    const msg = g.message.trim();
    if (!msg || msg === exclude) continue;
    lines.push(msg);
    if (lines.length >= 2) break;
  }
  return lines;
}

function repositoryContextPhrases(facts: ScanNarrativeFacts): CatalogPhrase[] {
  const phrases: CatalogPhrase[] = [];
  const seen = new Set<string>();
  for (const ctx of facts.repositoryContext) {
    const phrase = phraseForFamily(ctx.family);
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    phrases.push(phrase);
    if (phrases.length >= 3) break;
  }
  return phrases;
}

function composeContextLine(facts: ScanNarrativeFacts): string | null {
  const parts: string[] = [];
  const runtime = labelRuntimeSurface(facts);
  const reach = labelReachability(facts);
  const blast = labelBlastRadius(facts);
  if (runtime) parts.push(runtime);
  if (reach) parts.push(reach);
  if (blast) parts.push(blast);
  const areas = formatAffectedAreaLabels(facts);
  if (areas.length > 0) {
    parts.push(areas.join(scanSurfaceCopy.narrativeCard.areasSeparator));
  }
  if (parts.length === 0) return null;
  return parts.join(scanSurfaceCopy.narrativeCard.contextSeparator);
}

function buildLegacyObservations(
  facts: ScanNarrativeFacts,
  primaryInsight: string | null,
): { operationalObservations: CatalogPhrase[]; supportingLine: string | null } {
  const repoPhrases = repositoryContextPhrases(facts);
  const secondary = selectSecondaryLines(facts, primaryInsight);

  if (primaryInsight) {
    return {
      operationalObservations: repoPhrases.slice(0, 1),
      supportingLine:
        repoPhrases[0] && repoPhrases[0] !== primaryInsight
          ? repoPhrases[0]
          : (secondary[0] ?? null),
    };
  }

  if (repoPhrases.length === 0) {
    return { operationalObservations: [], supportingLine: null };
  }

  return {
    operationalObservations: repoPhrases.slice(0, 3),
    supportingLine: repoPhrases.length === 1 ? (secondary[0] ?? null) : null,
  };
}

/**
 * Dashboard card presentation DTO from consumer-agnostic facts.
 */
export function presentScanCardSummary(
  facts: ScanNarrativeFacts,
  options: PresentScanCardSummaryOptions = {},
): ScanCardSummary {
  const pipelineStatus = options.pipelineStatus ?? "done";
  const emptyPresentationFields = {
    narrativeMode: facts.availability.mode,
    codeIntelligenceAvailable: facts.availability.codeIntelligenceAvailable,
    changedPackagesDisplay: null as string | null,
    runtimeSurfaceLabel: null as string | null,
    reachabilityLabel: null as string | null,
    blastRadiusLabel: null as string | null,
    affectedAreas: [] as string[],
    primaryInsight: null as string | null,
    structuralOnlyDisclaimer: null as string | null,
  };

  if (pipelineStatus === "queued" || pipelineStatus === "running") {
    return {
      mergePosture: null,
      riskIndex: null,
      riskIndexBand: null,
      headline: scanSurfaceCopy.pipeline.scanRunning,
      summaryLine: "Waiting for results…",
      findingCounts: null,
      topAffectedAreas: [],
      operationalObservations: [],
      supportingLine: null,
      ...emptyPresentationFields,
    };
  }

  if (pipelineStatus === "failed") {
    return {
      mergePosture: null,
      riskIndex: null,
      riskIndexBand: null,
      headline: scanSurfaceCopy.pipeline.analysisIncomplete,
      summaryLine: null,
      findingCounts: null,
      topAffectedAreas: [],
      operationalObservations: [],
      supportingLine: null,
      ...emptyPresentationFields,
    };
  }

  const posture = facts.mergePosture;
  const riskIndex = facts.riskIndex;
  const riskIndexBand = deriveRiskIndexBand(riskIndex);
  const headline = posture
    ? MERGE_POSTURE_LABEL[posture]
    : scanSurfaceCopy.checkRun.mergePostureUnavailable;

  const findingCounts: FindingCountSummary | null = options.findings
    ? aggregateFindingCounts(options.findings)
    : null;

  const changedPackagesDisplay = formatChangedPackagesDisplay(facts);
  const runtimeSurfaceLabel = labelRuntimeSurface(facts);
  const reachabilityLabel = labelReachability(facts);
  const blastRadiusLabel = labelBlastRadius(facts);
  const affectedAreas = formatAffectedAreaLabels(facts);
  const contextLine = composeContextLine(facts);

  const structuralOnlyDisclaimer =
    facts.availability.mode === "graph_fallback" &&
    !facts.availability.tiersPresent.tier1
      ? scanSurfaceCopy.narrativeCard.structuralOnlyDisclaimer
      : null;

  const insightMessage = selectPrimaryInsight(facts);
  const primaryInsight =
    insightMessage ??
    (facts.availability.mode !== "graph_fallback" ? contextLine : null);

  const { operationalObservations, supportingLine } = buildLegacyObservations(
    facts,
    primaryInsight,
  );

  return {
    mergePosture: posture,
    riskIndex,
    riskIndexBand,
    headline,
    summaryLine: null,
    findingCounts,
    topAffectedAreas: affectedAreas,
    operationalObservations,
    supportingLine,
    narrativeMode: facts.availability.mode,
    codeIntelligenceAvailable: facts.availability.codeIntelligenceAvailable,
    changedPackagesDisplay,
    runtimeSurfaceLabel,
    reachabilityLabel,
    blastRadiusLabel,
    affectedAreas,
    primaryInsight,
    structuralOnlyDisclaimer,
  };
}

export type { CardExposureDisplay, MergePosture };

export function exposureFromFacts(
  facts: ScanNarrativeFacts,
): CardExposureDisplay | null {
  return deriveCardExposureDisplay(facts.riskIndex) ?? null;
}
