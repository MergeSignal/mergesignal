import {
  MERGE_POSTURE_SORT_ORDER,
  type MergePosture,
  type ScanCardPresentation,
  type ScanCardPresentationState,
  type ScanPipelineStatus,
} from "@mergesignal/shared";
import type { GithubOpenPR } from "./github-open-pull-requests";

export type PrScanEntry = {
  scanId: string;
  pipelineStatus: ScanPipelineStatus;
  cardPresentation: ScanCardPresentation;
  createdAt: string;
  githubPrNumber: number;
  githubHeadSha: string | null;
  githubBaseRef: string | null;
  scannedAt: string | null;
};

export type PrScanAggregates = {
  totalCovered: number;
  byDecision: { safe: number; needs_review: number; risky: number };
};

export type PrScanQuotaStatus = {
  source: "github";
  state: "ok" | "exceeded";
  limit: number;
  used: number;
  windowHours: number;
  resetsAt?: string;
};

export type PrScanIndexResponse = {
  repoId: string;
  byPrNumber: Record<string, PrScanEntry>;
  aggregates: PrScanAggregates;
  quotaStatus?: PrScanQuotaStatus;
};

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
  scanState: ScanState;
  posture: MergePosture | null;
  isOutdated: boolean;
  cardPresentation: ScanCardPresentation | null;
  timestampIso: string;
};

export type RepoPullHealthViewModel = {
  rows: PRHealthRow[];
  totalPRs: number;
  coveredPRs: number;
  byPosture: { risky: number; needs_review: number; safe: number };
  hasMore: boolean;
};

function derivePresentationState(
  scan: PrScanEntry | null,
  prHeadSha: string,
): ScanCardPresentationState {
  if (!scan) return "not_scanned";

  const pipeline = scan.pipelineStatus;
  if (pipeline === "queued" || pipeline === "running") return "scanning";
  if (pipeline === "failed") return "analysis_failed";
  if (pipeline === "done") {
    const isStale =
      scan.githubHeadSha != null && scan.githubHeadSha !== prHeadSha;
    return isStale ? "stale" : "ready";
  }
  return "analysis_failed";
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
    const cardPresentation = scan?.cardPresentation ?? null;
    const posture = cardPresentation?.status ?? null;
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
      cardPresentation,
      timestampIso,
    };
  });

  rows.sort((a, b) => {
    const aOrder = a.posture ? MERGE_POSTURE_SORT_ORDER[a.posture] : -1;
    const bOrder = b.posture ? MERGE_POSTURE_SORT_ORDER[b.posture] : -1;
    if (aOrder !== bOrder) return bOrder - aOrder;

    const aScore = a.cardPresentation?.riskIndex ?? -1;
    const bScore = b.cardPresentation?.riskIndex ?? -1;
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
