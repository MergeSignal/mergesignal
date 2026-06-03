import {
  phraseForFamily,
  type CatalogPhrase,
} from "./cardObservationCatalog.js";
import {
  aggregateFindingCounts,
  deriveRiskIndexBand,
  SCAN_CARD_SCANNING_SUMMARY,
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
import {
  composeContextLineFromFacts,
  composeVerificationPrompt,
  formatBlastRadiusDetailLine,
  formatChangedPackagesShort,
  formatFrameworksSummary,
  formatUsageSummaryLine,
  labelBlastRadiusLevel,
  labelReachabilityKind,
  labelRuntimeSurface,
  selectReviewerGuidance,
} from "./narrativePresentation.js";
import {
  normalizeGeneratedText,
  normalizeGeneratedTextNullable,
} from "./normalizeGeneratedText.js";
import { MERGE_POSTURE_LABEL, type MergePosture } from "./riskVocabulary.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import type { ScanResult } from "./types.js";

export type PresentScanCardSummaryOptions = {
  pipelineStatus?: ScanPipelineStatus;
  findings?: ScanResult["findings"];
};

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

function repositoryContextPhrases(
  facts: ScanNarrativeFacts,
  max: number,
): CatalogPhrase[] {
  const phrases: CatalogPhrase[] = [];
  const seen = new Set<string>();
  for (const ctx of facts.repositoryContext) {
    const phrase = phraseForFamily(ctx.family);
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    phrases.push(phrase);
    if (phrases.length >= max) break;
  }
  return phrases;
}

function buildLegacyObservations(
  facts: ScanNarrativeFacts,
  primaryInsight: string | null,
  repoPhraseCap: number,
): { operationalObservations: CatalogPhrase[]; supportingLine: string | null } {
  const repoPhrases = repositoryContextPhrases(facts, repoPhraseCap);
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
    operationalObservations: repoPhrases.slice(0, repoPhraseCap),
    supportingLine: repoPhrases.length === 1 ? (secondary[0] ?? null) : null,
  };
}

function normalizeCardSummary(summary: ScanCardSummary): ScanCardSummary {
  return {
    ...summary,
    headline: normalizeGeneratedText(summary.headline),
    summaryLine: normalizeGeneratedTextNullable(summary.summaryLine),
    supportingLine: normalizeGeneratedTextNullable(summary.supportingLine),
    changedPackagesDisplay: normalizeGeneratedTextNullable(
      summary.changedPackagesDisplay,
    ),
    runtimeSurfaceLabel: normalizeGeneratedTextNullable(
      summary.runtimeSurfaceLabel,
    ),
    reachabilityLabel: normalizeGeneratedTextNullable(
      summary.reachabilityLabel,
    ),
    blastRadiusLabel: normalizeGeneratedTextNullable(summary.blastRadiusLabel),
    primaryInsight: normalizeGeneratedTextNullable(summary.primaryInsight),
    structuralOnlyDisclaimer: normalizeGeneratedTextNullable(
      summary.structuralOnlyDisclaimer,
    ),
    usageSummary: normalizeGeneratedTextNullable(summary.usageSummary),
    verificationLine: normalizeGeneratedTextNullable(summary.verificationLine),
    blastRadiusDetail: normalizeGeneratedTextNullable(
      summary.blastRadiusDetail,
    ),
    frameworksSummary: normalizeGeneratedTextNullable(
      summary.frameworksSummary,
    ),
    affectedAreas: summary.affectedAreas.map((a) => normalizeGeneratedText(a)),
    topAffectedAreas: summary.topAffectedAreas.map((a) =>
      normalizeGeneratedText(a),
    ),
    operationalObservations: summary.operationalObservations.map((p) =>
      normalizeGeneratedText(p),
    ),
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
    usageSummary: null as string | null,
    verificationLine: null as string | null,
    blastRadiusDetail: null as string | null,
    frameworksSummary: null as string | null,
  };

  if (pipelineStatus === "queued" || pipelineStatus === "running") {
    return normalizeCardSummary({
      mergePosture: null,
      riskIndex: null,
      riskIndexBand: null,
      headline: scanSurfaceCopy.pipeline.scanRunning,
      summaryLine: SCAN_CARD_SCANNING_SUMMARY,
      findingCounts: null,
      topAffectedAreas: [],
      operationalObservations: [],
      supportingLine: null,
      ...emptyPresentationFields,
    });
  }

  if (pipelineStatus === "failed") {
    return normalizeCardSummary({
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
    });
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

  const prIntelligence =
    facts.availability.mode === "pr_intelligence" ||
    facts.availability.tiersPresent.tier1;

  const changedPackagesDisplay = formatChangedPackagesShort(facts, 2);
  const runtimeSurfaceLabel = labelRuntimeSurface(facts);
  const reachabilityLabel = labelReachabilityKind(facts);
  const blastRadiusLabel = labelBlastRadiusLevel(facts);
  const affectedAreas = formatAffectedAreaLabels(facts);
  const contextLine = composeContextLineFromFacts(facts, {
    includePathSample: prIntelligence,
    maxAreas: 2,
  });

  const structuralOnlyDisclaimer =
    facts.availability.mode === "graph_fallback" &&
    !facts.availability.tiersPresent.tier1
      ? scanSurfaceCopy.narrativeCard.structuralOnlyDisclaimer
      : null;

  const insightMessage = selectPrimaryInsight(facts);
  const primaryInsight =
    insightMessage ??
    (facts.availability.mode !== "graph_fallback" ? contextLine : null);

  const usageSummary = prIntelligence ? formatUsageSummaryLine(facts, 1) : null;
  const verificationLine = prIntelligence
    ? composeVerificationPrompt(facts)
    : null;
  const blastRadiusDetail = prIntelligence
    ? formatBlastRadiusDetailLine(facts, 1)
    : null;
  const frameworksSummary = prIntelligence
    ? formatFrameworksSummary(facts, 2)
    : null;

  const repoPhraseCap = prIntelligence ? 0 : 3;
  const { operationalObservations, supportingLine } = buildLegacyObservations(
    facts,
    primaryInsight,
    repoPhraseCap,
  );

  return normalizeCardSummary({
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
    usageSummary,
    verificationLine,
    blastRadiusDetail,
    frameworksSummary,
  });
}

export type { CardExposureDisplay, MergePosture };

export function exposureFromFacts(
  facts: ScanNarrativeFacts,
): CardExposureDisplay | null {
  return deriveCardExposureDisplay(facts.riskIndex) ?? null;
}
