import type { FastifyInstance } from "fastify";
import {
  type DashboardCardPresentation,
  type ScanCardPresentationState,
  type ScanPipelineStatus,
} from "@mergesignal/shared";
import { db } from "../db.js";
import { sendProblem } from "../problem.js";
import { getOwnerGithubQuotaStatus } from "../services/scanQuota.js";
import {
  buildCardForResolvedScan,
  groupRowsByPrNumber,
  parsePrHeadsQuery,
  resolvePrScanForHead,
  type PrScanDbRow,
} from "../services/resolvePrScanIndex.js";

type PrScanIndexEntry = {
  scanId: string;
  pipelineStatus: ScanPipelineStatus;
  presentationState: ScanCardPresentationState;
  cardPresentation: DashboardCardPresentation;
  createdAt: string;
  githubPrNumber: number;
  githubHeadSha: string | null;
  githubBaseRef: string | null;
  scannedAt: string | null;
  githubSurfacesPublishedAt: string | null;
};

type PrScanAggregates = {
  totalCovered: number;
  byDecision: { safe: number; needs_review: number; risky: number };
};

export async function repoPullRequestScansRoutes(app: FastifyInstance) {
  app.get("/repo/:owner/:repo/pull-request-scans", async (req, reply) => {
    const { owner, repo } = req.params as { owner: string; repo: string };
    const query = req.query as { prHeads?: string };

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

    const prHeads = parsePrHeadsQuery(query.prHeads);

    const [scanRowsResult, quotaStatus] = await Promise.all([
      db.query<PrScanDbRow>(
        `SELECT
         id AS scan_id,
         status,
         decision,
         total_score,
         pr_risk_score,
         repository_health_score,
         github_pr_number,
         github_head_sha,
         github_base_ref,
         created_at,
         result_generated_at,
         result,
         github_surfaces_published_at
       FROM scans
       WHERE repo_id = $1
         AND github_pr_number IS NOT NULL
       ORDER BY github_pr_number, created_at DESC`,
        [repoId],
      ),
      getOwnerGithubQuotaStatus(owner),
    ]);

    const { rows } = scanRowsResult;
    const byPr = groupRowsByPrNumber(rows);

    const prTargets =
      prHeads.size > 0
        ? [...prHeads.entries()]
        : [...byPr.keys()].map(
            (prNumber) =>
              [
                prNumber,
                byPr.get(prNumber)?.[0]?.github_head_sha ?? "",
              ] as const,
          );

    const byPrNumber: Record<string, PrScanIndexEntry> = {};
    const aggregates: PrScanAggregates = {
      totalCovered: 0,
      byDecision: { safe: 0, needs_review: 0, risky: 0 },
    };

    for (const [prNumber, headSha] of prTargets) {
      if (!headSha) continue;
      const resolved = resolvePrScanForHead(rows, prNumber, headSha);
      if (!resolved) continue;

      const { row, presentationState, pipelineStatus } = resolved;
      const scannedAt = row.result_generated_at
        ? new Date(row.result_generated_at).toISOString()
        : null;
      const cardPresentation = buildCardForResolvedScan(resolved);

      const d = row.decision;
      if (
        presentationState === "ready" &&
        pipelineStatus === "done" &&
        (d === "safe" || d === "needs_review" || d === "risky")
      ) {
        aggregates.byDecision[d] += 1;
      }

      const prKey = String(prNumber);
      byPrNumber[prKey] = {
        scanId: row.scan_id,
        pipelineStatus,
        presentationState,
        cardPresentation,
        createdAt: new Date(row.created_at).toISOString(),
        githubPrNumber: row.github_pr_number,
        githubHeadSha: row.github_head_sha,
        githubBaseRef: row.github_base_ref,
        scannedAt,
        githubSurfacesPublishedAt: row.github_surfaces_published_at
          ? new Date(row.github_surfaces_published_at).toISOString()
          : null,
      };
      aggregates.totalCovered += 1;
    }

    return reply.send({ repoId, quotaStatus, byPrNumber, aggregates });
  });
}
