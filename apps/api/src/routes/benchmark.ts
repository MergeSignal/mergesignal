import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { sendProblem } from "../problem.js";

type BenchmarkSummary = {
  scope: "global" | "owner";
  owner?: string;
  repoCount: number;
  avgTotalScore: number | null;
  medianTotalScore: number | null;
  p10TotalScore: number | null;
  p25TotalScore: number | null;
  p75TotalScore: number | null;
  p90TotalScore: number | null;
  worst: Array<{ repoId: string; totalScore: number; createdAt: string }>;
  best: Array<{ repoId: string; totalScore: number; createdAt: string }>;
};

export async function benchmarkRoutes(app: FastifyInstance) {
  app.get("/benchmark/global", async () => {
    return await getBenchmarkSummary({ scope: "global" });
  });

  app.get("/benchmark/org/:owner", async (req, reply) => {
    const owner = String((req.params as { owner: string }).owner ?? "").trim();
    if (!owner) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "owner is required" });

    // Authorization check: ensure authenticated owner matches requested owner
    if (req.authenticatedOwner && req.authenticatedOwner !== owner) {
      return sendProblem(reply, req, { status: 403, title: "Forbidden", detail: "Access denied to this organization" });
    }

    return await getBenchmarkSummary({ scope: "owner", owner });
  });

  app.get("/benchmark/repo", async (req, reply) => {
    const repoId = String((req.query as { repoId?: string })?.repoId ?? "").trim();
    if (!repoId) return sendProblem(reply, req, { status: 400, title: "Bad Request", detail: "repoId is required" });

    const owner = repoId.includes("/") ? repoId.split("/")[0] : repoId;

    // Authorization check: if using org-scoped API key, ensure repoId belongs to owner
    if (req.authenticatedOwner && req.authenticatedOwner !== owner) {
      return sendProblem(reply, req, { status: 403, title: "Forbidden", detail: "Access denied to this repository" });
    }

    const { rows } = await db.query(
      `
      WITH latest AS (
        SELECT DISTINCT ON (repo_id)
          repo_id,
          id AS scan_id,
          total_score,
          layer_security,
          layer_maintainability,
          layer_ecosystem,
          layer_upgrade_impact,
          methodology_version,
          created_at
        FROM scans
        WHERE status='done' AND total_score IS NOT NULL
        ORDER BY repo_id, created_at DESC
      ),
      ranked_global AS (
        SELECT repo_id, cume_dist() OVER (ORDER BY total_score) AS pct_global
        FROM latest
      ),
      ranked_owner AS (
        SELECT repo_id, cume_dist() OVER (PARTITION BY split_part(repo_id,'/',1) ORDER BY total_score) AS pct_owner
        FROM latest
      )
      SELECT
        l.repo_id,
        l.scan_id,
        l.total_score,
        l.layer_security,
        l.layer_maintainability,
        l.layer_ecosystem,
        l.layer_upgrade_impact,
        l.methodology_version,
        l.created_at,
        g.pct_global,
        o.pct_owner
      FROM latest l
      JOIN ranked_global g USING (repo_id)
      JOIN ranked_owner o USING (repo_id)
      WHERE l.repo_id=$1
      `,
      [repoId],
    );

    if (!rows.length) {
      return sendProblem(reply, req, { status: 404, title: "Not Found", detail: "No scored scans found for repoId" });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: Record<string, any> = rows[0];
    return {
      repoId,
      owner,
      latest: {
        scanId: r.scan_id,
        totalScore: r.total_score,
        layerScores: {
          security: r.layer_security,
          maintainability: r.layer_maintainability,
          ecosystem: r.layer_ecosystem,
          upgradeImpact: r.layer_upgrade_impact,
        },
        methodologyVersion: r.methodology_version,
        createdAt: new Date(r.created_at).toISOString(),
      },
      percentiles: {
        global: clamp01(r.pct_global),
        owner: clamp01(r.pct_owner),
      },
      interpretation: {
        note: "Percentiles are based on latest scored scan per repo. Higher percentile means higher relative risk (higher totalScore).",
      },
    };
  });
}

async function getBenchmarkSummary(opts: { scope: "global" } | { scope: "owner"; owner: string }): Promise<BenchmarkSummary> {
  const params: unknown[] = [];
  let where = "status='done' AND total_score IS NOT NULL";
  if (opts.scope === "owner") {
    params.push(opts.owner);
    where += ` AND split_part(repo_id,'/',1)=$${params.length}`;
  }

  const base = `
    WITH latest AS (
      SELECT DISTINCT ON (repo_id)
        repo_id,
        id AS scan_id,
        total_score,
        created_at
      FROM scans
      WHERE ${where}
      ORDER BY repo_id, created_at DESC
    )
  `;

  const summary = await db.query(
    `
    ${base}
    SELECT
      COUNT(*)::int AS repo_count,
      AVG(total_score)::float AS avg_total_score,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY total_score)::float AS median_total_score,
      percentile_cont(0.10) WITHIN GROUP (ORDER BY total_score)::float AS p10_total_score,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY total_score)::float AS p25_total_score,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY total_score)::float AS p75_total_score,
      percentile_cont(0.90) WITHIN GROUP (ORDER BY total_score)::float AS p90_total_score
    FROM latest
    `,
    params,
  );

  const worst = await db.query(
    `
    ${base}
    SELECT repo_id, total_score, created_at
    FROM latest
    ORDER BY total_score DESC
    LIMIT 5
    `,
    params,
  );

  const best = await db.query(
    `
    ${base}
    SELECT repo_id, total_score, created_at
    FROM latest
    ORDER BY total_score ASC
    LIMIT 5
    `,
    params,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: Record<string, any> = summary.rows?.[0] ?? {};
  return {
    scope: opts.scope,
    owner: opts.scope === "owner" ? opts.owner : undefined,
    repoCount: Number(s.repo_count ?? 0),
    avgTotalScore: toNullableNumber(s.avg_total_score),
    medianTotalScore: toNullableNumber(s.median_total_score),
    p10TotalScore: toNullableNumber(s.p10_total_score),
    p25TotalScore: toNullableNumber(s.p25_total_score),
    p75TotalScore: toNullableNumber(s.p75_total_score),
    p90TotalScore: toNullableNumber(s.p90_total_score),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    worst: worst.rows.map((r: Record<string, any>) => ({
      repoId: r.repo_id,
      totalScore: Number(r.total_score),
      createdAt: new Date(r.created_at).toISOString(),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    best: best.rows.map((r: Record<string, any>) => ({
      repoId: r.repo_id,
      totalScore: Number(r.total_score),
      createdAt: new Date(r.created_at).toISOString(),
    })),
  };
}

function toNullableNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp01(v: unknown): number | null {
  const n = toNullableNumber(v);
  if (n === null) return null;
  return Math.max(0, Math.min(1, n));
}

