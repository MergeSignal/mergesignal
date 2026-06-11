import {
  presentSurfacesIncompleteDashboardCard,
  resolvePipelineStatus,
  type ScanCardPresentationState,
  type ScanPipelineStatus,
  type ScanResult,
} from "@mergesignal/shared";
import { buildScanCardForApi } from "./scanPresentationService.js";

export type PrScanDbRow = {
  scan_id: string;
  status: string;
  decision: string | null;
  total_score: number | null;
  github_pr_number: number;
  github_head_sha: string | null;
  github_base_ref: string | null;
  created_at: Date;
  result_generated_at: Date | null;
  result: Record<string, unknown> | null;
  github_surfaces_published_at: Date | null;
};

export type ResolvedPrScan = {
  row: PrScanDbRow;
  presentationState: ScanCardPresentationState;
  pipelineStatus: ScanPipelineStatus;
};

function asScanResult(
  result: Record<string, unknown> | null,
): ScanResult | null {
  if (!result) return null;
  return result as ScanResult;
}

function rowPipelineStatus(
  row: PrScanDbRow,
  scannedAt: string | null,
): ScanPipelineStatus {
  return resolvePipelineStatus(row.status, {
    decision: row.decision,
    totalScore: row.total_score,
    hasResult: row.result != null,
    scannedAt,
  });
}

function isSurfaced(row: PrScanDbRow): boolean {
  return row.github_surfaces_published_at != null;
}

function matchesHead(row: PrScanDbRow, headSha: string): boolean {
  return row.github_head_sha === headSha;
}

function newestFirst(rows: PrScanDbRow[]): PrScanDbRow[] {
  return [...rows].sort(
    (a, b) => b.created_at.getTime() - a.created_at.getTime(),
  );
}

/**
 * Resolves one canonical scan row per (prNumber, headSha) using dashboard priority.
 */
export function resolvePrScanForHead(
  allRows: PrScanDbRow[],
  prNumber: number,
  headSha: string,
): ResolvedPrScan | null {
  const rows = newestFirst(
    allRows.filter((r) => r.github_pr_number === prNumber),
  );
  if (rows.length === 0) return null;

  const active = rows.find(
    (r) =>
      matchesHead(r, headSha) &&
      (r.status === "queued" || r.status === "running"),
  );
  if (active) {
    const scannedAt = active.result_generated_at
      ? new Date(active.result_generated_at).toISOString()
      : null;
    return {
      row: active,
      presentationState: "scanning",
      pipelineStatus: rowPipelineStatus(active, scannedAt),
    };
  }

  const failed = rows.find(
    (r) => matchesHead(r, headSha) && r.status === "failed",
  );
  if (failed) {
    const scannedAt = failed.result_generated_at
      ? new Date(failed.result_generated_at).toISOString()
      : null;
    return {
      row: failed,
      presentationState: "analysis_failed",
      pipelineStatus: rowPipelineStatus(failed, scannedAt),
    };
  }

  const ready = rows.find(
    (r) =>
      matchesHead(r, headSha) &&
      r.status === "done" &&
      isSurfaced(r) &&
      r.result != null,
  );
  if (ready) {
    return {
      row: ready,
      presentationState: "ready",
      pipelineStatus: "done",
    };
  }

  const incomplete = rows.find(
    (r) =>
      matchesHead(r, headSha) &&
      r.status === "done" &&
      !isSurfaced(r) &&
      r.result != null,
  );
  if (incomplete) {
    return {
      row: incomplete,
      presentationState: "surfaces_incomplete",
      pipelineStatus: "done",
    };
  }

  const stale = rows.find(
    (r) => r.status === "done" && isSurfaced(r) && r.result != null,
  );
  if (stale && stale.github_head_sha !== headSha) {
    return {
      row: stale,
      presentationState: "stale",
      pipelineStatus: "done",
    };
  }

  return null;
}

export function parsePrHeadsQuery(
  raw: string | undefined,
): Map<number, string> {
  const map = new Map<number, string>();
  if (!raw?.trim()) return map;
  for (const segment of raw.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const pr = Number(trimmed.slice(0, colon));
    const sha = trimmed.slice(colon + 1).trim();
    if (!Number.isFinite(pr) || pr <= 0 || !sha) continue;
    map.set(pr, sha);
  }
  return map;
}

export function buildCardForResolvedScan(
  resolved: ResolvedPrScan,
): ReturnType<typeof buildScanCardForApi> {
  const { row, presentationState } = resolved;
  const scannedAt = row.result_generated_at
    ? new Date(row.result_generated_at).toISOString()
    : null;

  if (presentationState === "surfaces_incomplete") {
    return presentSurfacesIncompleteDashboardCard();
  }

  return buildScanCardForApi({
    pipelineStatus: row.status,
    decision: row.decision,
    totalScore: row.total_score,
    result: asScanResult(row.result),
    scannedAt,
    presentationState,
  });
}

export function groupRowsByPrNumber(
  rows: PrScanDbRow[],
): Map<number, PrScanDbRow[]> {
  const byPr = new Map<number, PrScanDbRow[]>();
  for (const row of rows) {
    const list = byPr.get(row.github_pr_number) ?? [];
    list.push(row);
    byPr.set(row.github_pr_number, list);
  }
  return byPr;
}
