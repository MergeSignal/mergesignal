import type { FastifyInstance } from "fastify";
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

function extractSummaryText(
  result: Record<string, unknown> | null,
): string | null {
  if (!result) return null;
  const decision = result.decision as { reasoning?: string[] } | undefined;
  const reasoning = decision?.reasoning;
  if (Array.isArray(reasoning) && reasoning.length > 0) {
    const first = String(reasoning[0]).trim();
    return first.length > 120 ? first.slice(0, 119) + "…" : first;
  }
  const findings = result.findings as Array<{ severity?: string }> | undefined;
  if (Array.isArray(findings) && findings.length > 0) {
    const high = findings.filter((f) => f.severity === "high").length;
    const medium = findings.filter((f) => f.severity === "medium").length;
    if (high > 0)
      return `${high} high-severity finding${high > 1 ? "s" : ""} detected`;
    if (medium > 0)
      return `${medium} medium-severity finding${medium > 1 ? "s" : ""} detected`;
  }
  return null;
}

function extractTopAffectedAreas(
  result: Record<string, unknown> | null,
  max = 3,
  maxLabelLen = 38,
): string[] {
  if (!result) return [];

  function trimLabel(s: string): string {
    const clean = s.replace(/^(Finding:\s*|Area:\s*)/i, "").trim();
    return clean.length > maxLabelLen
      ? clean.slice(0, maxLabelLen - 1) + "…"
      : clean;
  }

  const seen = new Set<string>();
  const areas: string[] = [];

  function add(label: string): boolean {
    if (areas.length >= max) return false;
    const t = trimLabel(label);
    const key = t.toLowerCase();
    if (!t || seen.has(key)) return false;
    seen.add(key);
    areas.push(t);
    return true;
  }

  // Priority 1: explain reasons sorted by |scoreImpact|
  const explain = result.explain as
    | { reasons?: Array<{ title?: string; scoreImpact?: number }> }
    | undefined;
  if (Array.isArray(explain?.reasons)) {
    const sorted = [...explain.reasons]
      .filter((r) => r.title)
      .sort(
        (a, b) => Math.abs(b.scoreImpact ?? 0) - Math.abs(a.scoreImpact ?? 0),
      );
    for (const r of sorted) {
      if (!add(r.title!)) break;
    }
  }

  if (areas.length >= max) return areas;

  // Priority 2: PR insights (dedupe by message prefix)
  const insights = result.insights as Array<{ message?: string }> | undefined;
  if (Array.isArray(insights)) {
    for (const ins of insights) {
      if (!ins.message) continue;
      if (!add(ins.message.split(".")[0] ?? ins.message)) break;
    }
  }

  if (areas.length >= max) return areas;

  // Priority 3: layer names from layerScores only when nothing else found
  if (areas.length === 0) {
    const layerScores = result.layerScores as
      | Record<string, number>
      | undefined;
    if (layerScores) {
      const LAYER_LABELS: Record<string, string> = {
        security: "Security",
        maintainability: "Maintainability",
        ecosystem: "Ecosystem",
        upgradeImpact: "Upgrade impact",
      };
      const sorted = Object.entries(layerScores)
        .filter(([, v]) => typeof v === "number")
        .sort(([, a], [, b]) => (b as number) - (a as number));
      for (const [layer] of sorted) {
        if (!add(LAYER_LABELS[layer] ?? layer)) break;
      }
    }
  }

  return areas;
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
      const d = row.decision;
      if (d === "safe" || d === "needs_review" || d === "risky") {
        aggregates.byDecision[d] += 1;
      }

      byPrNumber[prKey] = {
        scanId: row.scan_id,
        status: row.status,
        decision: row.decision,
        totalScore: row.total_score,
        githubPrNumber: row.github_pr_number,
        githubHeadSha: row.github_head_sha,
        githubBaseRef: row.github_base_ref,
        createdAt: new Date(row.created_at).toISOString(),
        resultGeneratedAt: row.result_generated_at
          ? new Date(row.result_generated_at).toISOString()
          : null,
        summaryText: extractSummaryText(row.result),
        topAffectedAreas: extractTopAffectedAreas(row.result),
      };
    }

    return reply.send({ repoId, byPrNumber, aggregates });
  });
}
