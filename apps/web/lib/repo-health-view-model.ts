import {
  isPipelinePlaceholderCopy,
  mergePostureFromDecision,
  MERGE_POSTURE_SORT_ORDER,
  resolvePipelineStatus,
  resolvePrScanCardSummary,
  type MergePosture,
  type ScanCardPresentationState,
  type ScanCardSummary,
  type ScanPipelineStatus,
} from "@mergesignal/shared";
import type { GithubOpenPR } from "./github-open-pull-requests";

export type PrScanEntry = {
  scanId: string;
  pipelineStatus: ScanPipelineStatus;
  cardSummary: ScanCardSummary;
  createdAt: string;
  githubPrNumber: number;
  githubHeadSha: string | null;
  githubBaseRef: string | null;
  scannedAt: string | null;
  /** @deprecated Use cardSummary */
  status: string;
  /** @deprecated Use cardSummary.mergePosture */
  decision: string | null;
  /** @deprecated Use cardSummary.riskIndex */
  totalScore: number | null;
  /** @deprecated Use cardSummary.summaryLine */
  summaryText: string | null;
  /** @deprecated Use cardSummary.topAffectedAreas */
  topAffectedAreas: string[];
  /** @deprecated Use scannedAt */
  resultGeneratedAt: string | null;
};

export type PrScanAggregates = {
  totalCovered: number;
  byDecision: { safe: number; needs_review: number; risky: number };
};

export type PrScanIndexResponse = {
  repoId: string;
  byPrNumber: Record<string, PrScanEntry>;
  aggregates: PrScanAggregates;
};

/** @deprecated Use ScanCardPresentationState */
export type ScanState =
  | "done"
  | "in_progress"
  | "failed"
  | "not_scanned"
  | "outdated";

export type PRHealthRow = {
  pr: GithubOpenPR;
  scan: PrScanEntry | null;
  presentationState: ScanCardPresentationState;
  /** @deprecated Use presentationState */
  scanState: ScanState;
  posture: MergePosture | null;
  isOutdated: boolean;
  cardSummary: ScanCardSummary | null;
  timestampIso: string;
};

export type RepoPullHealthViewModel = {
  rows: PRHealthRow[];
  totalPRs: number;
  coveredPRs: number;
  byPosture: { risky: number; needs_review: number; safe: number };
  hasMore: boolean;
};

function pipelineForScan(scan: PrScanEntry): ScanPipelineStatus {
  return resolvePipelineStatus(scan.pipelineStatus ?? scan.status, {
    decision: scan.decision ?? scan.cardSummary?.mergePosture ?? null,
    totalScore: scan.totalScore ?? scan.cardSummary?.riskIndex ?? null,
    hasResult: scan.cardSummary?.mergePosture != null,
  });
}

function presentationToLegacyState(
  state: ScanCardPresentationState,
): ScanState {
  switch (state) {
    case "ready":
      return "done";
    case "scanning":
      return "in_progress";
    case "analysis_failed":
      return "failed";
    case "stale":
      return "outdated";
    default:
      return "not_scanned";
  }
}

function derivePresentationState(
  scan: PrScanEntry | null,
  prHeadSha: string,
): ScanCardPresentationState {
  if (!scan) return "not_scanned";

  const pipeline = pipelineForScan(scan);
  if (pipeline === "queued" || pipeline === "running") return "scanning";
  if (pipeline === "failed") return "analysis_failed";
  if (pipeline === "done") {
    const isStale =
      scan.githubHeadSha != null && scan.githubHeadSha !== prHeadSha;
    return isStale ? "stale" : "ready";
  }
  return "analysis_failed";
}

function cardSummaryForRow(scan: PrScanEntry | null): ScanCardSummary | null {
  if (!scan) return null;

  const legacySummaryText = isPipelinePlaceholderCopy(scan.summaryText)
    ? null
    : scan.summaryText;

  return resolvePrScanCardSummary({
    pipelineStatus: scan.pipelineStatus ?? scan.status,
    decision: scan.decision,
    totalScore: scan.totalScore,
    summaryText: legacySummaryText,
    result: null,
  });
}

function timestampForRow(
  pr: GithubOpenPR,
  scan: PrScanEntry | null,
  presentationState: ScanCardPresentationState,
): string {
  if (
    (presentationState === "ready" || presentationState === "stale") &&
    scan?.scannedAt
  ) {
    return scan.scannedAt;
  }
  if (presentationState === "scanning" && scan?.createdAt) {
    return scan.createdAt;
  }
  return pr.updatedAt;
}

/**
 * Merge a list of GitHub open PRs with the latest scan entry per PR.
 * Sorting: riskiest posture first, then highest risk index, then most-recently updated.
 */
export function buildRepoPullHealthViewModel(
  prs: GithubOpenPR[],
  index: PrScanIndexResponse,
  hasMore: boolean,
): RepoPullHealthViewModel {
  const byPosture = { risky: 0, needs_review: 0, safe: 0 };

  const rows: PRHealthRow[] = prs.map((pr): PRHealthRow => {
    const scan = index.byPrNumber[String(pr.number)] ?? null;
    const presentationState = derivePresentationState(scan, pr.headSha);
    const scanState = presentationToLegacyState(presentationState);
    const cardSummary = cardSummaryForRow(scan);
    const posture =
      cardSummary?.mergePosture ??
      (scan ? mergePostureFromDecision(scan.decision) : null);
    const isOutdated = presentationState === "stale";
    const timestampIso = timestampForRow(pr, scan, presentationState);

    if (posture && presentationState !== "scanning") {
      byPosture[posture] += 1;
    }

    return {
      pr,
      scan,
      presentationState,
      scanState,
      posture,
      isOutdated,
      cardSummary,
      timestampIso,
    };
  });

  rows.sort((a, b) => {
    const aOrder = a.posture ? MERGE_POSTURE_SORT_ORDER[a.posture] : -1;
    const bOrder = b.posture ? MERGE_POSTURE_SORT_ORDER[b.posture] : -1;
    if (aOrder !== bOrder) return bOrder - aOrder;

    const aScore = a.cardSummary?.riskIndex ?? a.scan?.totalScore ?? -1;
    const bScore = b.cardSummary?.riskIndex ?? b.scan?.totalScore ?? -1;
    if (aScore !== bScore) return bScore - aScore;

    return (
      new Date(b.pr.updatedAt).getTime() - new Date(a.pr.updatedAt).getTime()
    );
  });

  return {
    rows,
    totalPRs: prs.length,
    coveredPRs: index.aggregates.totalCovered,
    byPosture,
    hasMore,
  };
}
