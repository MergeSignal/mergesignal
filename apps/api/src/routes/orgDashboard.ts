import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { sendProblem } from "../problem.js";

type RepoRow = {
  repoId: string;
  latest: {
    scanId: string;
    status: string;
    totalScore: number | null;
    layerSecurity: number | null;
    layerMaintainability: number | null;
    layerEcosystem: number | null;
    layerUpgradeImpact: number | null;
    methodologyVersion: string | null;
    createdAt: string;
  };
  previous?: {
    scanId: string;
    totalScore: number | null;
    createdAt: string;
  };
  deltaTotalScore?: number | null;
};

export async function orgDashboardRoutes(app: FastifyInstance) {
  app.get("/org/:owner/dashboard", async (req, reply) => {
    const owner = String((req.params as { owner: string }).owner ?? "").trim();
    if (!owner) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "owner is required" });

    // Authorization check: ensure authenticated owner matches requested owner
    if (req.authenticatedOwner && req.authenticatedOwner !== owner) {
      return sendProblem(reply, req, { status: 403, title: "Forbidden", detail: "Access denied to this organization" });
    }

    const limitRaw = (req.query as { limit?: string })?.limit;
    const n = Math.max(1, Math.min(200, Number(limitRaw ?? 50)));

    const { rows } = await db.query(
      `
      WITH ranked AS (
        SELECT
          repo_id,
          id AS scan_id,
          status,
          total_score,
          layer_security,
          layer_maintainability,
          layer_ecosystem,
          layer_upgrade_impact,
          methodology_version,
          created_at,
          row_number() OVER (PARTITION BY repo_id ORDER BY created_at DESC) AS rn
        FROM scans
        WHERE split_part(repo_id, '/', 1) = $1
      ),
      latest AS (
        SELECT * FROM ranked WHERE rn = 1
      ),
      prev AS (
        SELECT repo_id, scan_id AS prev_scan_id, total_score AS prev_total_score, created_at AS prev_created_at
        FROM ranked
        WHERE rn = 2
      )
      SELECT
        latest.repo_id,
        latest.scan_id,
        latest.status,
        latest.total_score,
        latest.layer_security,
        latest.layer_maintainability,
        latest.layer_ecosystem,
        latest.layer_upgrade_impact,
        latest.methodology_version,
        latest.created_at,
        prev.prev_scan_id,
        prev.prev_total_score,
        prev.prev_created_at,
        CASE
          WHEN latest.total_score IS NULL OR prev.prev_total_score IS NULL THEN NULL
          ELSE latest.total_score - prev.prev_total_score
        END AS delta_total_score
      FROM latest
      LEFT JOIN prev USING (repo_id)
      ORDER BY latest.created_at DESC
      LIMIT $2
      `,
      [owner, n],
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repos: RepoRow[] = rows.map((r: Record<string, any>) => ({
      repoId: r.repo_id,
      latest: {
        scanId: r.scan_id,
        status: r.status,
        totalScore: r.total_score,
        layerSecurity: r.layer_security,
        layerMaintainability: r.layer_maintainability,
        layerEcosystem: r.layer_ecosystem,
        layerUpgradeImpact: r.layer_upgrade_impact,
        methodologyVersion: r.methodology_version,
        createdAt: new Date(r.created_at).toISOString(),
      },
      previous: r.prev_scan_id
        ? {
            scanId: r.prev_scan_id,
            totalScore: r.prev_total_score,
            createdAt: new Date(r.prev_created_at).toISOString(),
          }
        : undefined,
      deltaTotalScore: r.delta_total_score,
    }));

    const scored = repos.filter((x) => typeof x.latest.totalScore === "number") as Array<
      RepoRow & { latest: RepoRow["latest"] & { totalScore: number } }
    >;
    const avgScore =
      scored.length === 0
        ? null
        : Math.round(scored.reduce((sum, r) => sum + r.latest.totalScore, 0) / scored.length);

    const worst = [...scored]
      .sort((a, b) => a.latest.totalScore - b.latest.totalScore)
      .slice(0, 5)
      .map((r) => ({ repoId: r.repoId, totalScore: r.latest.totalScore }));

    return {
      owner,
      summary: {
        repoCount: repos.length,
        scoredRepoCount: scored.length,
        avgScore,
        worst,
      },
      repos,
    };
  });
}

