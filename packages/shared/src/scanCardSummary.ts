import type { CatalogPhrase } from "./cardObservationCatalog.js";
import { deriveScanNarrative } from "./deriveScanNarrative.js";
import { presentScanCardSummary } from "./presentScanCardSummary.js";
import type { NarrativeAvailabilityMode } from "./scanNarrativeFacts.js";
import {
  mergePostureFromDecision,
  MERGE_POSTURE_LABEL,
  type MergePosture,
} from "./riskVocabulary.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import type { Finding, ScanResult } from "./types.js";

export type ScanPipelineStatus = "queued" | "running" | "done" | "failed";

export type ScanCardPresentationState =
  | "not_scanned"
  | "scanning"
  | "analysis_failed"
  | "ready"
  | "stale";

export type RiskIndexBand = "low" | "medium" | "high";

export type FindingCountSummary = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type ScanCardSummary = {
  mergePosture: MergePosture | null;
  riskIndex: number | null;
  riskIndexBand: RiskIndexBand | null;
  headline: string;
  /** @deprecated Use operationalObservations */
  summaryLine: string | null;
  findingCounts: FindingCountSummary | null;
  /** @deprecated Use affectedAreas */
  topAffectedAreas: string[];
  /** Catalog-mapped topology observations (0–3). Tier 3 repo context — legacy wire field. */
  operationalObservations: CatalogPhrase[];
  /** Optional quiet subline when exactly one observation is shown. */
  supportingLine: string | null;
  narrativeMode: NarrativeAvailabilityMode;
  codeIntelligenceAvailable: boolean;
  changedPackagesDisplay: string | null;
  runtimeSurfaceLabel: string | null;
  reachabilityLabel: string | null;
  blastRadiusLabel: string | null;
  affectedAreas: string[];
  primaryInsight: string | null;
  structuralOnlyDisclaimer: string | null;
  /** One-line usage hint from packageUsage paths or areas. */
  usageSummary: string | null;
  /** Single verification prompt from changed-scope guidance or usage. */
  verificationLine: string | null;
  /** Optional blast factor subline when factors exist. */
  blastRadiusDetail: string | null;
  /** Short framework list (max 2 on card). */
  frameworksSummary: string | null;
};

const STALE_SUBLINE = "Based on earlier commit";
export const SCAN_CARD_SCANNING_SUMMARY = "Waiting for results...";

export type PipelineCompletionEvidence = {
  scannedAt?: string | null;
  decision?: string | null;
  totalScore?: number | null;
  hasResult?: boolean;
};

function normalizePipelineStatus(
  status: string | undefined,
): ScanPipelineStatus {
  const st = String(status ?? "")
    .trim()
    .toLowerCase();
  if (st === "queued" || st === "running" || st === "done" || st === "failed") {
    return st;
  }
  return "failed";
}

function isMergePostureDecision(
  decision: string | null | undefined,
): decision is MergePosture {
  return (
    decision === "safe" || decision === "needs_review" || decision === "risky"
  );
}

/** Scan completion signals — decision/totalScore/result are only set after analysis. */
export function hasScanCompletionEvidence(
  evidence: PipelineCompletionEvidence,
): boolean {
  if (isMergePostureDecision(evidence.decision)) return true;
  if (evidence.hasResult === true) return true;
  if (evidence.totalScore != null && Number.isFinite(evidence.totalScore)) {
    return true;
  }
  if (evidence.scannedAt?.trim()) return true;
  return false;
}

/**
 * Resolve wire status using completion evidence (decision, totalScore, result).
 * Handles races where denormalized columns are written before status flips to done.
 */
export function resolvePipelineStatus(
  status: string | undefined,
  evidence: PipelineCompletionEvidence,
): ScanPipelineStatus {
  const normalized = normalizePipelineStatus(status);
  if (normalized === "done" || normalized === "failed") return normalized;
  if (hasScanCompletionEvidence(evidence)) return "done";
  return normalized;
}

/** Pipeline lifecycle copy that must never appear on completed scan cards. */
export function isPipelinePlaceholderCopy(
  text: string | null | undefined,
): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  return (
    t === SCAN_CARD_SCANNING_SUMMARY ||
    t === scanSurfaceCopy.pipeline.scanRunning ||
    t === scanSurfaceCopy.pipeline.scanIncomplete ||
    t === scanSurfaceCopy.pipeline.scanUnavailable
  );
}

/** True when summary reflects pipeline lifecycle, not merge posture. */
export function isPipelineCardSummary(summary: ScanCardSummary): boolean {
  if (isPipelinePlaceholderCopy(summary.summaryLine)) return true;
  return (
    summary.mergePosture === null &&
    summary.riskIndex === null &&
    (summary.headline === scanSurfaceCopy.pipeline.scanRunning ||
      summary.headline === scanSurfaceCopy.pipeline.analysisIncomplete ||
      summary.headline === scanSurfaceCopy.pipeline.scanUnavailable) &&
    summary.narrativeMode === "denormalized"
  );
}

/** Single source for risk index color bands (aligns with decision score bands). */
export function deriveRiskIndexBand(
  score: number | null | undefined,
): RiskIndexBand | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score > 60) return "high";
  if (score > 30) return "medium";
  return "low";
}

export function aggregateFindingCounts(
  findings: Finding[] | null | undefined,
): FindingCountSummary {
  const counts: FindingCountSummary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  if (!Array.isArray(findings)) return counts;
  for (const f of findings) {
    const s = f.severity;
    if (s === "critical") counts.critical += 1;
    else if (s === "high") counts.high += 1;
    else if (s === "medium") counts.medium += 1;
    else if (s === "low") counts.low += 1;
  }
  return counts;
}

/**
 * Server-side card summary for PR dashboard list views.
 * Pipeline lifecycle copy is included when `pipelineStatus !== "done"`.
 *
 * Quiet safe cards with no mappable signals show posture + exposure only.
 */
export function deriveScanCardSummary(
  result: ScanResult | null | undefined,
  pipelineStatus: ScanPipelineStatus,
): ScanCardSummary {
  if (pipelineStatus === "queued" || pipelineStatus === "running") {
    return presentScanCardSummary(deriveScanNarrative(null), {
      pipelineStatus,
    });
  }

  if (pipelineStatus === "failed") {
    return presentScanCardSummary(deriveScanNarrative(null), {
      pipelineStatus: "failed",
    });
  }

  if (!result) {
    return {
      ...presentScanCardSummary(deriveScanNarrative(null), { pipelineStatus }),
      headline: scanSurfaceCopy.pipeline.scanUnavailable,
    };
  }

  const facts = deriveScanNarrative(result);
  return presentScanCardSummary(facts, {
    pipelineStatus,
    findings: result.findings,
  });
}

/** Subline appended when scan results are stale (head SHA mismatch). */
export function staleScanSubline(): string {
  return STALE_SUBLINE;
}

/** Rebuild card summary from denormalized scan columns when result JSON is unavailable. */
export function deriveScanCardSummaryFromDenormalized(
  decision: string | null,
  totalScore: number | null,
  summaryText: string | null,
  pipelineStatus: ScanPipelineStatus,
): ScanCardSummary {
  if (pipelineStatus !== "done") {
    return deriveScanCardSummary(null, pipelineStatus);
  }

  const posture = mergePostureFromDecision(decision);
  const minimalResult: ScanResult = {
    totalScore: totalScore ?? 0,
    layerScores: {
      security: 0,
      maintainability: 0,
      ecosystem: 0,
      upgradeImpact: 0,
    },
    findings: [],
    generatedAt: new Date().toISOString(),
    decision: posture
      ? { recommendation: posture, confidence: "medium", reasoning: [] }
      : undefined,
  };

  const summary = deriveScanCardSummary(minimalResult, "done");
  return summary;
}

export type PrScanCardSummaryInput = {
  pipelineStatus: string;
  decision: string | null;
  totalScore: number | null;
  summaryText: string | null;
  result: ScanResult | null;
  scannedAt?: string | null;
};

/**
 * Canonical card summary for PR list/dashboard — single derivation path for API + web.
 */
export function resolvePrScanCardSummary(
  input: PrScanCardSummaryInput,
): ScanCardSummary {
  const effectivePipeline = resolvePipelineStatus(input.pipelineStatus, {
    decision: input.decision,
    totalScore: input.totalScore,
    hasResult: input.result != null,
    scannedAt: input.scannedAt,
  });

  if (effectivePipeline === "done") {
    const scanResult =
      input.result ??
      (hasScanCompletionEvidence({
        decision: input.decision,
        totalScore: input.totalScore,
        hasResult: false,
      })
        ? ({
            totalScore: input.totalScore ?? 0,
            layerScores: {
              security: 0,
              maintainability: 0,
              ecosystem: 0,
              upgradeImpact: 0,
            },
            findings: [],
            generatedAt: new Date().toISOString(),
            decision: mergePostureFromDecision(input.decision)
              ? {
                  recommendation: mergePostureFromDecision(input.decision)!,
                  confidence: "medium" as const,
                  reasoning: [],
                }
              : undefined,
          } satisfies ScanResult)
        : null);

    if (scanResult) {
      const fromResult = deriveScanCardSummary(scanResult, "done");
      if (!isPipelineCardSummary(fromResult)) return fromResult;
    }

    return deriveScanCardSummaryFromDenormalized(
      input.decision,
      input.totalScore,
      input.summaryText,
      "done",
    );
  }

  return deriveScanCardSummary(input.result, effectivePipeline);
}
