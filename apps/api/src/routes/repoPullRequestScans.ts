import type { FastifyInstance } from "fastify";
import {
  resolvePipelineStatus,
  resolvePrScanCardSummary,
  type ScanCardSummary,
  type ScanPipelineStatus,
  type ScanResult,
} from "@mergesignal/shared";
import { db } from "../db.js";
import { sendProblem } from "../problem.js";

type PrScanIndexEntry = {
  scanId: string;
  pipelineStatus: ScanPipelineStatus;
  cardSummary: ScanCardSummary;
  createdAt: string;
  githubPrNumber: number;
  githubHeadSha: string | null;
  githubBaseRef: string | null;
  scannedAt: string | null;
  /** @deprecated Use cardSummary fields */
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

type PrScanAggregates = {
  totalCovered: number;
  byDecision: { safe: number; needs_review: number; risky: number };
};

function asScanResult(
  result: Record<string, unknown> | null,
): ScanResult | null {
  if (!result) return null;
  return result as ScanResult;
}

export async function repoPullRequestScansRoutes(app: FastifyInstance) {
  app.get("/repo/:owner/:repo/pull-request-scans", async (req, reply) => {
    const { owner, repo } = req.params as { owner: string; repo: string };

    if (!owner?.trim() || !repo?.trim()) {
      return sendProblem(reply, req, {
        status: 400,
        title: "Bad Request",
        detail: "owner and repo path parameters are required",
      });
    }

    const repoId = `${owner}/${repo}`;

    if (req.authenticatedOwner && req.authenticatedOwner !== owner) {
      return sendProblem(reply, req, {
        status: 403,
        title: "Forbidden",
        detail: "Access denied to this repository",
      });
    }

    const { rows } = await db.query<{
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
    }>(
      `SELECT DISTINCT ON (github_pr_number)
         id AS scan_id,
         status,
         decision,
         total_score,
         github_pr_number,
         github_head_sha,
         github_base_ref,
         created_at,
         result_generated_at,
         result
       FROM scans
       WHERE repo_id = $1
         AND github_pr_number IS NOT NULL
       ORDER BY github_pr_number, created_at DESC`,
      [repoId],
    );

    const byPrNumber: Record<string, PrScanIndexEntry> = {};
    const aggregates: PrScanAggregates = {
      totalCovered: rows.length,
      byDecision: { safe: 0, needs_review: 0, risky: 0 },
    };

    for (const row of rows) {
      const prKey = String(row.github_pr_number);
      const pipelineStatus = resolvePipelineStatus(row.status, {
        decision: row.decision,
        totalScore: row.total_score,
        hasResult: row.result != null,
      });
      const d = row.decision;
      if (
        pipelineStatus === "done" &&
        (d === "safe" || d === "needs_review" || d === "risky")
      ) {
        aggregates.byDecision[d] += 1;
      }

      const cardSummary = resolvePrScanCardSummary({
        pipelineStatus: row.status,
        decision: row.decision,
        totalScore: row.total_score,
        summaryText: null,
        result: asScanResult(row.result),
      });
      const scannedAt = row.result_generated_at
        ? new Date(row.result_generated_at).toISOString()
        : null;

      byPrNumber[prKey] = {
        scanId: row.scan_id,
        pipelineStatus,
        cardSummary,
        createdAt: new Date(row.created_at).toISOString(),
        githubPrNumber: row.github_pr_number,
        githubHeadSha: row.github_head_sha,
        githubBaseRef: row.github_base_ref,
        scannedAt,
        status: pipelineStatus,
        decision: row.decision,
        totalScore: row.total_score,
        summaryText: cardSummary.summaryLine,
        topAffectedAreas: cardSummary.topAffectedAreas,
        resultGeneratedAt: scannedAt,
      };
    }

    return reply.send({ repoId, byPrNumber, aggregates });
  });
}
