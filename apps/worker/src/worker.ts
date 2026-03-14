import "dotenv/config";
import { Worker } from "bullmq";
import { Pool } from "pg";
import type { ScanLockfileInput, ScanRequest, UpgradeSimulationResult } from "@reposentinel/shared";
import { analyze, simulateUpgrade } from "@reposentinel/engine-stub";
import { App } from "@octokit/app";

const db = new Pool({ connectionString: process.env.DATABASE_URL });

type ScanStatus = "queued" | "running" | "done" | "failed";

type ScanJob = {
  scanId: string;
  repoId: string;
  dependencyGraph: unknown;
  lockfile?: ScanRequest["lockfile"];
  baseLockfile?: ScanLockfileInput;
  github?: {
    owner: string;
    repo: string;
    prNumber: number;
    headSha: string;
    baseSha?: string;
    installationId: number;
    deliveryId?: string;
  };
};

const connection = { url: process.env.REDIS_URL! };

const workerId = `pid:${process.pid}`;
const heartbeatEveryMs = Number(process.env.SCAN_HEARTBEAT_MS ?? 15000);
const staleAfterMs = Number(process.env.SCAN_STALE_AFTER_MS ?? 60000);
const reapEveryMs = Number(process.env.SCAN_REAP_INTERVAL_MS ?? 30000);

setInterval(() => {
  void requeueStaleRunningScans();
}, reapEveryMs);

new Worker<ScanJob>(
  "scan-queue",
  async (job) => {
    const { scanId, repoId, dependencyGraph, lockfile, baseLockfile, github } = job.data;

    const moved = await transitionToRunning(scanId);
    if (!moved) {
      return { skipped: true };
    }

    const heartbeat = setInterval(() => {
      void db.query(
        "UPDATE scans SET heartbeat_at=NOW() WHERE id=$1 AND status='running'",
        [scanId],
      );
    }, heartbeatEveryMs);

    try {
      const req: ScanRequest = { repoId, dependencyGraph, lockfile };
      const delayMs = Number(process.env.SCAN_SIMULATE_DELAY_MS ?? 0);
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      const result = await analyze(req);

      const totalScore = toInt(result.totalScore);
      const security = toInt(result.layerScores.security);
      const maintainability = toInt(result.layerScores.maintainability);
      const ecosystem = toInt(result.layerScores.ecosystem);
      const upgradeImpact = toInt(result.layerScores.upgradeImpact);
      const methodologyVersion = result.methodologyVersion ?? null;
      const generatedAt = result.generatedAt ?? null;

      const { rowCount } = await db.query(
        "UPDATE scans SET status='done', result=$2::jsonb, total_score=$3, layer_security=$4, layer_maintainability=$5, layer_ecosystem=$6, layer_upgrade_impact=$7, methodology_version=$8, result_generated_at=$9::timestamptz, finished_at=NOW(), heartbeat_at=NULL, updated_at=NOW() WHERE id=$1 AND status='running'",
        [
          scanId,
          JSON.stringify(result),
          totalScore,
          security,
          maintainability,
          ecosystem,
          upgradeImpact,
          methodologyVersion,
          generatedAt,
        ],
      );

      if (rowCount !== 1) {
        throw new Error("Scan is not running; refusing to overwrite result");
      }

      if (github?.prNumber) {
        try {
          await postGithubPrReviewComment({
            scanId,
            repoId,
            lockfile,
            baseLockfile,
            github,
          });
        } catch (e: any) {
          // Don’t fail the scan if commenting fails; log and continue.
          // eslint-disable-next-line no-console
          console.error("Failed to post PR review comment:", String(e?.message ?? e));
        }
      }

      return { ok: true };
    } catch (e: any) {
      await db.query(
        "UPDATE scans SET status='failed', error=$2, finished_at=NOW(), heartbeat_at=NULL, updated_at=NOW() WHERE id=$1 AND status='running'",
        [scanId, String(e?.message ?? e)],
      );

      if (github?.prNumber) {
        try {
          await postGithubPrFailureComment({
            scanId,
            repoId,
            github,
            error: String(e?.message ?? e),
          });
        } catch (e2: any) {
          // eslint-disable-next-line no-console
          console.error("Failed to post PR failure comment:", String(e2?.message ?? e2));
        }
      }

      throw e;
    } finally {
      clearInterval(heartbeat);
    }
  },
  { connection },
);

async function transitionToRunning(scanId: string) {
  const { rowCount } = await db.query(
    "UPDATE scans SET status='running', attempt=attempt+1, worker_id=$2, started_at=COALESCE(started_at, NOW()), heartbeat_at=NOW(), updated_at=NOW() WHERE id=$1 AND status='queued'",
    [scanId, workerId],
  );
  return rowCount === 1;
}

async function requeueStaleRunningScans() {
  const { rowCount } = await db.query(
    "UPDATE scans SET status='queued', worker_id=NULL, updated_at=NOW() WHERE status='running' AND heartbeat_at IS NOT NULL AND heartbeat_at < NOW() - ($1::int * INTERVAL '1 millisecond')",
    [staleAfterMs],
  );
  return rowCount;
}

function toInt(n: unknown): number | null {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.round(v);
}

const PR_COMMENT_MARKER = "<!-- reposentinel:pr-risk-review -->";

function loadGithubApp() {
  const appId = process.env.GITHUB_APP_ID ? Number(process.env.GITHUB_APP_ID) : undefined;
  const privateKeyRaw = process.env.GITHUB_PRIVATE_KEY;
  if (!appId || !privateKeyRaw) return null;
  const privateKey = privateKeyRaw.includes("\\n") ? privateKeyRaw.replace(/\\n/g, "\n") : privateKeyRaw;
  return new App({ appId, privateKey });
}

async function postGithubPrReviewComment(opts: {
  scanId: string;
  repoId: string;
  lockfile?: ScanLockfileInput;
  baseLockfile?: ScanLockfileInput;
  github: NonNullable<ScanJob["github"]>;
}) {
  const ghApp = loadGithubApp();
  if (!ghApp) return;

  const { owner, repo, prNumber, installationId } = opts.github;

  const simulation = await computePrSimulation({
    repoId: opts.repoId,
    baseLockfile: opts.baseLockfile,
    headLockfile: opts.lockfile,
  });

  const body = renderPrComment({
    scanId: opts.scanId,
    repoId: opts.repoId,
    github: opts.github,
    simulation,
  });

  const octokit = await ghApp.getInstallationOctokit(installationId);
  await upsertIssueComment(octokit, { owner, repo, issueNumber: prNumber, body });
}

async function postGithubPrFailureComment(opts: {
  scanId: string;
  repoId: string;
  github: NonNullable<ScanJob["github"]>;
  error: string;
}) {
  const ghApp = loadGithubApp();
  if (!ghApp) return;

  const { owner, repo, prNumber, installationId } = opts.github;
  const body = [
    PR_COMMENT_MARKER,
    "## RepoSentinel PR Risk Review",
    "",
    `Scan failed for \`${opts.repoId}\` (scanId: \`${opts.scanId}\`).`,
    "",
    "```",
    truncate(opts.error, 900),
    "```",
  ].join("\n");

  const octokit = await ghApp.getInstallationOctokit(installationId);
  await upsertIssueComment(octokit, { owner, repo, issueNumber: prNumber, body });
}

async function computePrSimulation(opts: {
  repoId: string;
  baseLockfile?: ScanLockfileInput;
  headLockfile?: ScanLockfileInput;
}): Promise<UpgradeSimulationResult | null> {
  const { baseLockfile, headLockfile } = opts;
  if (!baseLockfile || !headLockfile) return null;
  if (baseLockfile.manager !== "pnpm" || headLockfile.manager !== "pnpm") return null;

  return simulateUpgrade({
    repoId: opts.repoId,
    currentLockfile: baseLockfile,
    proposedLockfile: headLockfile,
  });
}

function renderPrComment(opts: {
  scanId: string;
  repoId: string;
  github: NonNullable<ScanJob["github"]>;
  simulation: UpgradeSimulationResult | null;
}) {
  const { simulation } = opts;
  const lines: string[] = [];
  lines.push(PR_COMMENT_MARKER);
  lines.push("## RepoSentinel PR Risk Review");
  lines.push("");
  lines.push(`Repo: \`${opts.repoId}\` • PR: #${opts.github.prNumber} • scanId: \`${opts.scanId}\``);
  lines.push("");

  if (!simulation?.after || !simulation?.delta) {
    lines.push(
      "No lockfile delta available (currently only `pnpm-lock.yaml` supports base vs PR comparison).",
    );
    return lines.join("\n");
  }

  const before = simulation.before;
  const after = simulation.after;
  const d = simulation.delta;
  lines.push(
    `**Total score**: ${before.totalScore} → ${after.totalScore} (Δ ${formatSigned(d.totalScoreDelta ?? 0)})`,
  );
  lines.push("");

  const layerDeltas = d.layerScoreDeltas ?? {};
  const layerBits = Object.entries(layerDeltas)
    .filter(([, v]) => typeof v === "number" && v !== 0)
    .map(([k, v]) => `${k}: ${formatSigned(v as number)}`);
  if (layerBits.length) {
    lines.push(`**Layer deltas**: ${layerBits.join(", ")}`);
    lines.push("");
  }

  const top = d.topSignalDeltas ?? [];
  if (top.length) {
    lines.push("**Top signal deltas**:");
    for (const s of top.slice(0, 6)) {
      lines.push(
        `- \`${s.id}\` (${s.layer}) impact ${formatSigned(s.scoreImpactBefore ?? 0)} → ${formatSigned(s.scoreImpactAfter ?? 0)}`,
      );
    }
    lines.push("");
  }

  const recs = after.recommendations ?? [];
  if (recs.length) {
    lines.push("**Top recommendations (after)**:");
    for (const r of recs.slice(0, 3)) {
      lines.push(`- ${r.title} (${r.priorityScore ?? 0})`);
    }
    lines.push("");
  }

  lines.push("_Generated by RepoSentinel._");
  return lines.join("\n");
}

async function upsertIssueComment(
  octokit: any,
  opts: { owner: string; repo: string; issueNumber: number; body: string },
) {
  const { owner, repo, issueNumber, body } = opts;
  const comments = await octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });
  const existing = (comments.data as any[]).find((c) =>
    String(c?.body ?? "").includes(PR_COMMENT_MARKER),
  );

  if (existing?.id) {
    await octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    return;
  }

  await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

function formatSigned(n: number) {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return "0";
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
