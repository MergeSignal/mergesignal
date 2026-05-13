import type { FastifyInstance } from "fastify";
import {
  deriveScanSummaryText,
  selectTopAffectedAreas,
  type ScanResult,
} from "@mergesignal/shared";
import { db } from "../db.js";
import { sendProblem } from "../problem.js";

// Compact summary extracted server-side from result JSONB to avoid
// shipping the full multi-KB result to list clients.
type PrScanSummary = {
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

    // One query: latest scan per PR (DISTINCT ON) plus the full result JSONB
    // for server-side extraction of summary/areas; result is not returned raw.
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

    const byPrNumber: Record<string, PrScanSummary> = {};
    const aggregates: PrScanAggregates = {
      totalCovered: rows.length,
      byDecision: { safe: 0, needs_review: 0, risky: 0 },
    };

    for (const row of rows) {
      const prKey = String(row.github_pr_number);
      const statusLc = String(row.status ?? "")
        .trim()
        .toLowerCase();
      const d = row.decision;
      if (
        statusLc === "done" &&
        (d === "safe" || d === "needs_review" || d === "risky")
      ) {
        aggregates.byDecision[d] += 1;
      }

      const scanResult = statusLc === "done" ? asScanResult(row.result) : null;

      byPrNumber[prKey] = {
        scanId: row.scan_id,
        status: statusLc,
        decision: row.decision,
        totalScore: row.total_score,
        githubPrNumber: row.github_pr_number,
        githubHeadSha: row.github_head_sha,
        githubBaseRef: row.github_base_ref,
        createdAt: new Date(row.created_at).toISOString(),
        resultGeneratedAt: row.result_generated_at
          ? new Date(row.result_generated_at).toISOString()
          : null,
        summaryText: deriveScanSummaryText(scanResult),
        topAffectedAreas: selectTopAffectedAreas(scanResult),
      };
    }

    return reply.send({ repoId, byPrNumber, aggregates });
  });
}
