import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { sendProblem } from "../problem.js";

export async function repoOverviewRoutes(app: FastifyInstance) {
  app.get("/repo/:owner/:repo/overview", async (req, reply) => {
    const { owner, repo } = req.params as { owner: string; repo: string };

    if (!owner?.trim() || !repo?.trim()) {
      return sendProblem(reply, req, {
        status: 400,
        title: "Bad Request",
        detail: "owner and repo path parameters are required",
      });
    }

    const repoId = `${owner}/${repo}`;

    // Honor org-scoped API keys — must match the repo owner
    if (req.authenticatedOwner && req.authenticatedOwner !== owner) {
      return sendProblem(reply, req, {
        status: 403,
        title: "Forbidden",
        detail: "Access denied to this repository",
      });
    }

    const [scanResult, alertResult] = await Promise.all([
      db.query<{
        id: string;
        status: string;
        total_score: number | null;
        layer_security: number | null;
        layer_maintainability: number | null;
        layer_ecosystem: number | null;
        layer_upgrade_impact: number | null;
        methodology_version: string | null;
        created_at: Date;
        decision: string | null;
      }>(
        `SELECT id, status, total_score, layer_security, layer_maintainability,
                layer_ecosystem, layer_upgrade_impact, methodology_version,
                created_at, decision
         FROM scans
         WHERE repo_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [repoId],
      ),
      db.query<{ severity: string; count: number }>(
        `SELECT severity, COUNT(*)::int AS count
         FROM alerts
         WHERE repo_id = $1
         GROUP BY severity`,
        [repoId],
      ),
    ]);

    const scan = scanResult.rows[0] ?? null;

    const alertCounts: Record<"high" | "medium" | "low", number> = {
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const row of alertResult.rows) {
      const sev = row.severity?.toLowerCase();
      if (sev === "high" || sev === "medium" || sev === "low") {
        alertCounts[sev] = row.count;
      }
    }

    return reply.send({
      repoId,
      latestScan: scan
        ? {
            id: scan.id,
            status: scan.status,
            totalScore: scan.total_score,
            layerSecurity: scan.layer_security,
            layerMaintainability: scan.layer_maintainability,
            layerEcosystem: scan.layer_ecosystem,
            layerUpgradeImpact: scan.layer_upgrade_impact,
            methodologyVersion: scan.methodology_version,
            createdAt: new Date(scan.created_at).toISOString(),
            decision: scan.decision ?? null,
          }
        : null,
      alertCounts,
    });
  });
}
