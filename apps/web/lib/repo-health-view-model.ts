import {
  mergePostureFromDecision,
  MERGE_POSTURE_SORT_ORDER,
  type MergePosture,
} from "@mergesignal/shared";
import type { GithubOpenPR } from "./github-open-pull-requests";

export type PrScanEntry = {
  scanId: string;
  status: string;
  decision: string | null;
  totalScore: number | null;
  githubPrNumber: number;
  githubHeadSha: string | null;
  githubBaseRef: string | null;
  createdAt: string;
  resultGeneratedAt: string | null;
  summaryText: string | null;
  topAffectedAreas: string[];
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

export type ScanState =
  | "done"
  | "in_progress"
  | "failed"
  | "not_scanned"
  | "outdated";

export type PRHealthRow = {
  pr: GithubOpenPR;
  scan: PrScanEntry | null;
  scanState: ScanState;
  posture: MergePosture | null;
  isOutdated: boolean;
};

export type RepoPullHealthViewModel = {
  rows: PRHealthRow[];
  totalPRs: number;
  coveredPRs: number;
  byPosture: { risky: number; needs_review: number; safe: number };
  hasMore: boolean;
};

function normalizeScanStatus(status: string | undefined): string {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Merge a list of GitHub open PRs with the latest scan entry per PR.
 * Sorting: riskiest posture first, then highest risk score, then most-recently updated.
 */
export function buildRepoPullHealthViewModel(
  prs: GithubOpenPR[],
  index: PrScanIndexResponse,
  hasMore: boolean,
): RepoPullHealthViewModel {
  const byPosture = { risky: 0, needs_review: 0, safe: 0 };

  const rows: PRHealthRow[] = prs.map((pr): PRHealthRow => {
    const scan = index.byPrNumber[String(pr.number)] ?? null;
    const posture = scan ? mergePostureFromDecision(scan.decision) : null;

    let scanState: ScanState = "not_scanned";
    if (scan) {
      const st = normalizeScanStatus(scan.status);
      if (st === "done") {
        const isOutdated =
          scan.githubHeadSha != null && scan.githubHeadSha !== pr.headSha;
        scanState = isOutdated ? "outdated" : "done";
      } else if (st === "queued" || st === "running") {
        scanState = "in_progress";
      } else if (st === "failed") {
        scanState = "failed";
      }
    }

    const isOutdated = scanState === "outdated";

    if (posture) byPosture[posture] += 1;

    return { pr, scan, scanState, posture, isOutdated };
  });

  // Sort: riskiest first by posture, then by score desc, then by updatedAt desc
  rows.sort((a, b) => {
    const aOrder = a.posture ? MERGE_POSTURE_SORT_ORDER[a.posture] : -1;
    const bOrder = b.posture ? MERGE_POSTURE_SORT_ORDER[b.posture] : -1;
    if (aOrder !== bOrder) return bOrder - aOrder;

    const aScore = a.scan?.totalScore ?? -1;
    const bScore = b.scan?.totalScore ?? -1;
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
