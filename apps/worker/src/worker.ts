import "dotenv/config";
import { Worker } from "bullmq";
import { Pool } from "pg";
import type { ScanLockfileInput, ScanRequest, UpgradeSimulationResult } from "@reposentinel/shared";
import { analyze, simulateUpgrade } from "@reposentinel/engine";
import { App } from "@octokit/app";
import { randomUUID } from "crypto";
import { getLimitsForOwner, getOwnerFromRepoId } from "./tier.js";
import { persistPackageHealthDataset } from "./dataset.js";
import { logger } from "./logger.js";

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

logger.info("Worker starting", {
  workerId,
  heartbeatEveryMs,
  staleAfterMs,
  reapEveryMs,
});

setInterval(() => {
  void requeueStaleRunningScans();
}, reapEveryMs);

const alertsEveryMs = Number(process.env.ALERTS_INTERVAL_MS ?? 60 * 60 * 1000);

setTimeout(() => {
  void runAlertsTick();
}, 10000);
setInterval(() => {
  void runAlertsTick();
}, alertsEveryMs);

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
      const rawResult = await analyze(req);

      // Apply tier limits to engine output
      const owner = getOwnerFromRepoId(repoId);
      const limits = getLimitsForOwner(owner);
      const result = applyTierLimitsToScanResult(rawResult, limits);

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

      try {
        const observations = result.dataset?.packageHealth;
        if (Array.isArray(observations) && observations.length) {
          await persistPackageHealthDataset(db, { repoId, scanId, observations });
        }
      } catch (e: any) {
        logger.error("Dataset persistence failed", {
          scanId,
          repoId,
          error: String(e?.message ?? e),
        });
      }

      try {
        await evaluatePoliciesForScan({ repoId, scanId, result });
      } catch (e: any) {
        logger.error("Policy evaluation failed", {
          scanId,
          repoId,
          error: String(e?.message ?? e),
        });
      }

      if (github?.prNumber && limits.prCommentsEnabled) {
        try {
          await postGithubPrReviewComment({
            scanId,
            repoId,
            lockfile,
            baseLockfile,
            github,
            limits,
          });
        } catch (e: any) {
          logger.error("Failed to post PR review comment", { scanId, repoId, prNumber: github?.prNumber, error: String(e?.message ?? e) });
        }
      }

      return { ok: true };
    } catch (e: any) {
      await db.query(
        "UPDATE scans SET status='failed', error=$2, finished_at=NOW(), heartbeat_at=NULL, updated_at=NOW() WHERE id=$1 AND status='running'",
        [scanId, String(e?.message ?? e)],
      );

      const owner = getOwnerFromRepoId(repoId);
      const limits = getLimitsForOwner(owner);

      if (github?.prNumber && limits.prCommentsEnabled) {
        try {
          await postGithubPrFailureComment({
            scanId,
            repoId,
            github,
            error: String(e?.message ?? e),
          });
        } catch (e2: any) {
          logger.error("Failed to post PR failure comment", { scanId, repoId, prNumber: github?.prNumber, error: String(e2?.message ?? e2) });
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
  limits: ReturnType<typeof getLimitsForOwner>;
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
    limits: opts.limits,
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
  if (baseLockfile.manager !== headLockfile.manager) return null;

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
  limits: ReturnType<typeof getLimitsForOwner>;
}) {
  const { simulation, limits } = opts;
  const lines: string[] = [];
  lines.push(PR_COMMENT_MARKER);
  lines.push("## 🛡️ RepoSentinel Security Analysis");
  lines.push("");

  if (!simulation?.after || !simulation?.delta) {
    lines.push("> ⚠️ **No lockfile changes detected**");
    lines.push(">");
    lines.push("> Cannot compare risk — lockfile must exist in both base and head branches.");
    return lines.join("\n");
  }

  const before = simulation.before;
  const after = simulation.after;
  const d = simulation.delta;
  const dep = (d as any)?.dependencyDelta;

  // Risk verdict - front and center
  const scoreDelta = d.totalScoreDelta ?? 0;
  const riskIcon = scoreDelta > 0 ? "🔴" : scoreDelta < 0 ? "🟢" : "⚪";
  const beforeScore = before.totalScore ?? 0;
  const afterScore = after.totalScore ?? 0;
  
  if (scoreDelta > 10) {
    lines.push(`### ${riskIcon} Risk Increased: ${beforeScore} → ${afterScore} (+${scoreDelta})`);
    lines.push("");
    lines.push("> ⚠️ **This PR significantly increases dependency risk.** Review the findings below before merging.");
  } else if (scoreDelta > 0) {
    lines.push(`### ${riskIcon} Risk Slightly Increased: ${beforeScore} → ${afterScore} (+${scoreDelta})`);
    lines.push("");
    lines.push("> This PR increases dependency risk. Consider the findings below.");
  } else if (scoreDelta < -10) {
    lines.push(`### ${riskIcon} Risk Decreased: ${beforeScore} → ${afterScore} (${scoreDelta})`);
    lines.push("");
    lines.push("> ✅ **Nice!** This PR reduces dependency risk.");
  } else if (scoreDelta < 0) {
    lines.push(`### ${riskIcon} Risk Slightly Decreased: ${beforeScore} → ${afterScore} (${scoreDelta})`);
    lines.push("");
    lines.push("> ✅ This PR reduces dependency risk slightly.");
  } else {
    lines.push(`### ${riskIcon} No Risk Change: ${afterScore}`);
    lines.push("");
    lines.push("> This PR has minimal impact on dependency risk.");
  }
  lines.push("");

  // Quick dependency summary - one line
  if (dep) {
    const parts: string[] = [];
    if (dep.directAdded > 0) parts.push(`**+${dep.directAdded} direct**`);
    if (dep.directRemoved > 0) parts.push(`**-${dep.directRemoved} direct**`);
    if (dep.directUpdated > 0) parts.push(`**~${dep.directUpdated} updated**`);
    if (parts.length) {
      lines.push(`📦 ${parts.join(" • ")}`);
      lines.push("");
    }
  }

  // Critical findings only (max configurable per tier, only if score increased)
  const findings = buildPrFindings({ before, after, dep });
  const maxFindings = limits.prCommentMaxFindings;
  if (scoreDelta > 0 && findings.length && maxFindings > 0) {
    lines.push("**⚠️ Key Concerns:**");
    for (const f of findings.slice(0, maxFindings)) {
      lines.push(`- ${f}`);
    }
    lines.push("");
  }

  // Actions - max configurable per tier, only if actionable
  const actions = buildPrActions({ after, dep });
  const maxActions = limits.prCommentMaxActions;
  if (actions.length && maxActions > 0) {
    lines.push("**✅ Recommended:**");
    for (const a of actions.slice(0, maxActions)) {
      lines.push(`- ${a}`);
    }
    lines.push("");
  }

  // Everything else in collapsible - for those who want details
  const hasDetails = dep?.topDirectAdded?.length || dep?.topDirectUpdated?.length || dep?.topDirectRemoved?.length;
  if (hasDetails) {
    lines.push("<details>");
    lines.push("<summary>📋 <strong>Dependency Details</strong></summary>");
    lines.push("");
    
    if (Array.isArray(dep.topDirectAdded) && dep.topDirectAdded.length) {
      lines.push(`**Added:** ${dep.topDirectAdded.slice(0, 3).map((x: any) => `\`${x}\``).join(", ")}`);
      if (dep.topDirectAdded.length > 3) {
        lines.push(` _(+${dep.topDirectAdded.length - 3} more)_`);
      }
      lines.push("");
    }
    if (Array.isArray(dep.topDirectUpdated) && dep.topDirectUpdated.length) {
      lines.push(`**Updated:** ${dep.topDirectUpdated.slice(0, 3).map((x: any) => `\`${x}\``).join(", ")}`);
      if (dep.topDirectUpdated.length > 3) {
        lines.push(` _(+${dep.topDirectUpdated.length - 3} more)_`);
      }
      lines.push("");
    }
    if (Array.isArray(dep.topDirectRemoved) && dep.topDirectRemoved.length) {
      lines.push(`**Removed:** ${dep.topDirectRemoved.slice(0, 3).map((x: any) => `\`${x}\``).join(", ")}`);
      if (dep.topDirectRemoved.length > 3) {
        lines.push(` _(+${dep.topDirectRemoved.length - 3} more)_`);
      }
      lines.push("");
    }
    
    lines.push("</details>");
    lines.push("");
  }

  // Link to full detailed report
  if (limits.prCommentShowDetailsLink) {
    const webBaseUrl = process.env.REPOSENTINEL_WEB_URL ?? "http://localhost:3000";
    const detailsUrl = `${webBaseUrl}/scan/${opts.scanId}`;
    lines.push(`[📊 View Full Detailed Report](${detailsUrl})`);
  } else {
    lines.push(`Scan ID: \`${opts.scanId}\``);
  }
  
  return lines.join("\n");
}

function formatSignedWithIcon(value: number): string {
  if (value > 0) return `🔴 +${value}`;
  if (value < 0) return `🟢 ${value}`;
  return `⚪ 0`;
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function buildPrFindings(opts: { before: any; after: any; dep: any }) {
  const out: string[] = [];
  const after = opts.after;
  const dep = opts.dep;

  const addedDirect = Array.isArray(dep?.topDirectAdded) ? dep.topDirectAdded.map(String) : [];
  const updatedDirect = Array.isArray(dep?.topDirectUpdated) ? dep.topDirectUpdated.map(String) : [];
  const focusDirect = [...addedDirect, ...updatedDirect].slice(0, 10);
  const pkgHealth = Array.isArray(after?.dataset?.packageHealth) ? after.dataset.packageHealth : [];
  const healthByName = new Map<string, any>(pkgHealth.map((p: any) => [String(p?.name ?? ""), p]));

  const staleDays = clampInt(process.env.REPOSENTINEL_HEALTH_STALE_DAYS, 365);
  const veryStaleDays = clampInt(process.env.REPOSENTINEL_HEALTH_VERY_STALE_DAYS, 730);
  const now = Date.now();

  for (const name of focusDirect.slice(0, 8)) {
    const h = healthByName.get(name);
    if (!h) continue;

    const latest = h.latestPublishedAt ? Date.parse(String(h.latestPublishedAt)) : NaN;
    if (Number.isFinite(latest)) {
      const days = Math.floor((now - latest) / (24 * 60 * 60 * 1000));
      if (days >= veryStaleDays) {
        out.push(`\`${name}\` — very stale releases (last release ${formatYearsAgo(days)} ago)`);
      } else if (days >= staleDays) {
        out.push(`\`${name}\` — stale releases (last release ${formatYearsAgo(days)} ago)`);
      }
    }

    const m = Number(h.maintainersCount ?? NaN);
    if (Number.isFinite(m) && m <= 1) {
      out.push(`\`${name}\` — single maintainer (bus factor)`);
    }
  }

  const osvTotal = (after?.signals ?? []).find((s: any) => String(s?.id ?? "") === "vuln.osv_total_vulns");
  const osvTop = (osvTotal?.evidence as any)?.top;
  if (Array.isArray(osvTop) && osvTop.length) {
    const relevant = focusDirect.length ? osvTop.filter((x: any) => focusDirect.includes(String(x?.name ?? ""))) : osvTop;
    const pool = (relevant.length ? relevant : osvTop) as any[];
    const worst = [...pool].sort(
      (a: any, b: any) => (b?.worstScore ?? 0) - (a?.worstScore ?? 0) || (b?.count ?? 0) - (a?.count ?? 0),
    )[0];
    if (worst?.name) {
      const label = `\`${String(worst.name)}\`${worst.worstScore ? ` — known advisories (worst CVSS ${worst.worstScore})` : " — known advisories"}`;
      out.push(label);
    }
  }

  const deepest = after?.graphInsights?.deepest;
  if (Array.isArray(deepest) && deepest.length) {
    const d = deepest[0];
    const via = Array.isArray(d?.via) && d.via.length ? ` via ${d.via.join(" → ")}` : "";
    out.push(`\`${String(d.packageName ?? "package")}\` — deeply nested (depth ${Number(d.depth ?? 0)})${via}`);
  }

  // De-dupe while preserving order
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x) ? false : (seen.add(x), true))).slice(0, 6);
}

function buildPrActions(opts: { after: any; dep: any }) {
  const after = opts.after;
  const dep = opts.dep;
  const out: string[] = [];

  const addedDirect = Array.isArray(dep?.topDirectAdded) ? dep.topDirectAdded.map(String) : [];
  const updatedDirect = Array.isArray(dep?.topDirectUpdated) ? dep.topDirectUpdated.map(String) : [];
  const focusDirect = [...addedDirect, ...updatedDirect].slice(0, 10);

  const pkgHealth = Array.isArray(after?.dataset?.packageHealth) ? after.dataset.packageHealth : [];
  const healthByName = new Map<string, any>(pkgHealth.map((p: any) => [String(p?.name ?? ""), p]));

  const staleDays = clampInt(process.env.REPOSENTINEL_HEALTH_STALE_DAYS, 365);
  const veryStaleDays = clampInt(process.env.REPOSENTINEL_HEALTH_VERY_STALE_DAYS, 730);
  const now = Date.now();

  for (const name of focusDirect.slice(0, 8)) {
    const h = healthByName.get(name);
    if (!h) continue;

    const latest = h.latestPublishedAt ? Date.parse(String(h.latestPublishedAt)) : NaN;
    if (Number.isFinite(latest)) {
      const days = Math.floor((now - latest) / (24 * 60 * 60 * 1000));
      if (days >= veryStaleDays) {
        out.push(`\`${name}\`: review justification / consider maintained alternative (very stale releases)`);
      } else if (days >= staleDays) {
        out.push(`\`${name}\`: confirm maintenance posture (stale releases)`);
      }
    }

    const m = Number(h.maintainersCount ?? NaN);
    if (Number.isFinite(m) && m <= 1) {
      out.push(`\`${name}\`: assess bus factor risk (single maintainer)`);
    }
  }

  const osvTotal = (after?.signals ?? []).find((s: any) => String(s?.id ?? "") === "vuln.osv_total_vulns");
  const osvTop = (osvTotal?.evidence as any)?.top;
  if (Array.isArray(osvTop) && osvTop.length) {
    const relevant = focusDirect.length ? osvTop.filter((x: any) => focusDirect.includes(String(x?.name ?? ""))) : osvTop;
    const pool = (relevant.length ? relevant : osvTop) as any[];
    const worst = [...pool].sort(
      (a: any, b: any) => (b?.worstScore ?? 0) - (a?.worstScore ?? 0) || (b?.count ?? 0) - (a?.count ?? 0),
    )[0];
    if (worst?.name) {
      out.push(
        `\`${String(worst.name)}\`: review advisories and upgrade/override if possible (known advisories detected)`,
      );
    }
  }

  const hotspots = after?.graphInsights?.hotspots;
  if (Array.isArray(hotspots) && hotspots.length) {
    const h = hotspots[0];
    if (h?.packageName) {
      out.push(
        `\`${String(h.packageName)}\`: treat as transitive hotspot (high fan-in); prefer upgrading the direct parent(s) listed in “via”`,
      );
    }
  }

  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x) ? false : (seen.add(x), true))).slice(0, 6);
}

function clampInt(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function formatYearsAgo(days: number) {
  const years = days / 365;
  if (years >= 2) return `${years.toFixed(1)} years`;
  const months = days / 30;
  if (months >= 2) return `${months.toFixed(1)} months`;
  return `${Math.max(0, days)} days`;
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

type RepoSource = {
  repo_id: string;
  owner: string;
  repo: string;
  installation_id: number;
  lockfile_path: string;
  lockfile_manager: string;
  default_branch: string | null;
};

type AlertCandidate = {
  repoId: string;
  fingerprint: string;
  type: string;
  severity: "low" | "medium" | "high";
  title: string;
  details: any;
};

let alertsRunning = false;
async function runAlertsTick() {
  if (alertsRunning) return;
  alertsRunning = true;
  try {
    const ghApp = loadGithubApp();
    if (!ghApp) return;

    const { rows } = await db.query(
      "SELECT repo_id, owner, repo, installation_id, lockfile_path, lockfile_manager, default_branch FROM repo_sources ORDER BY updated_at DESC LIMIT $1",
      [200],
    );

    const sources = rows as RepoSource[];
    if (sources.length === 0) return;

    const filtered = sources.filter((s) => getLimitsForOwner(s.owner).alertsEnabled);
    if (filtered.length === 0) return;

    const perOwner = new Map<string, RepoSource[]>();
    for (const s of filtered) {
      const a = perOwner.get(s.owner);
      if (a) a.push(s);
      else perOwner.set(s.owner, [s]);
    }

    const planned: RepoSource[] = [];
    for (const [owner, xs] of perOwner.entries()) {
      const lim = getLimitsForOwner(owner);
      planned.push(...xs.slice(0, lim.alertsBatchLimit));
    }

    const concurrency = Math.max(
      1,
      Math.min(10, Math.max(...planned.map((s) => getLimitsForOwner(s.owner).alertsConcurrency), 1)),
    );

    await withConcurrency(concurrency, planned, async (src) => {
      const lim = getLimitsForOwner(src.owner);
      await checkRepoForAlerts(ghApp, src, { minScoreImpact: lim.alertsMinScoreImpact });
    });
  } catch (e: any) {
    logger.error("Alerts tick failed", { error: String(e?.message ?? e) });
  } finally {
    alertsRunning = false;
  }
}

async function checkRepoForAlerts(
  ghApp: App,
  src: RepoSource,
  { minScoreImpact }: { minScoreImpact: number },
) {
  if (src.lockfile_manager !== "pnpm") return;

  const octokit = await ghApp.getInstallationOctokit(src.installation_id);

  let branch = src.default_branch;
  if (!branch) {
    const repoInfo = await octokit.request("GET /repos/{owner}/{repo}", {
      owner: src.owner,
      repo: src.repo,
    });
    branch = String((repoInfo.data as any)?.default_branch ?? "");
    if (branch) {
      await db.query("UPDATE repo_sources SET default_branch=$2, updated_at=NOW() WHERE repo_id=$1", [
        src.repo_id,
        branch,
      ]);
    }
  }
  if (!branch) return;

  const content = await tryFetchLockfile(octokit, {
    owner: src.owner,
    repo: src.repo,
    path: src.lockfile_path,
    ref: branch,
  });
  await db.query("UPDATE repo_sources SET last_checked_at=NOW(), updated_at=NOW() WHERE repo_id=$1", [
    src.repo_id,
  ]);
  if (!content) return;

  const after = await analyze({
    repoId: src.repo_id,
    dependencyGraph: {},
    lockfile: { manager: "pnpm", content, path: src.lockfile_path },
  });

  try {
    const observations = after.dataset?.packageHealth;
    if (Array.isArray(observations) && observations.length) {
      await persistPackageHealthDataset(db, { repoId: src.repo_id, observations });
    }
  } catch (e: any) {
    logger.error("Dataset persistence (alerts) failed", { repoId: src.repo_id, error: String(e?.message ?? e) });
  }

  const beforeSignals = await getLatestSignalsForRepo(src.repo_id);
  const candidates = deriveAlertCandidates({
    repoId: src.repo_id,
    beforeSignals,
    afterSignals: after.signals ?? [],
    minScoreImpact,
  });
  if (candidates.length === 0) return;

  for (const a of candidates) {
    await db.query(
      "INSERT INTO alerts (id, repo_id, fingerprint, type, severity, title, details) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT (repo_id, fingerprint) DO NOTHING",
      [randomUUID(), a.repoId, a.fingerprint, a.type, a.severity, a.title, JSON.stringify(a.details)],
    );
  }
}

async function getLatestSignalsForRepo(repoId: string) {
  const { rows } = await db.query(
    "SELECT result FROM scans WHERE repo_id=$1 AND status='done' AND result IS NOT NULL ORDER BY created_at DESC LIMIT 1",
    [repoId],
  );
  const r = rows[0]?.result;
  const signals = Array.isArray(r?.signals) ? r.signals : [];
  return indexSignalsById(signals);
}

function deriveAlertCandidates(opts: {
  repoId: string;
  beforeSignals: Record<string, any>;
  afterSignals: any[];
  minScoreImpact: number;
}): AlertCandidate[] {
  const out: AlertCandidate[] = [];

  for (const s of opts.afterSignals) {
    const id = String(s?.id ?? "");
    if (!id) continue;
    const scoreImpact = Number(s?.scoreImpact ?? 0);
    if (!Number.isFinite(scoreImpact) || scoreImpact < opts.minScoreImpact) continue;

    const before = opts.beforeSignals[id];
    const beforeImpact = Number(before?.scoreImpact ?? 0);
    const isNew = !before;
    const increased = scoreImpact - beforeImpact;
    if (!isNew && increased < 4) continue;

    const severity: AlertCandidate["severity"] =
      scoreImpact >= 15 ? "high" : scoreImpact >= opts.minScoreImpact ? "medium" : "low";
    const type = isNew ? "signal:new" : "signal:increased";
    const title = isNew ? `New risk signal: ${id}` : `Risk signal increased: ${id}`;
    const fingerprint = `${type}:${id}:${String(s?.value ?? "")}:${scoreImpact}`;

    out.push({
      repoId: opts.repoId,
      fingerprint,
      type,
      severity,
      title,
      details: { signalId: id, before: before ?? null, after: s },
    });
  }

  return out.slice(0, 20);
}

function indexSignalsById(signals: any[]) {
  const out: Record<string, any> = {};
  for (const s of signals) {
    const id = String(s?.id ?? "");
    if (id) out[id] = s;
  }
  return out;
}

async function tryFetchLockfile(
  octokit: any,
  opts: { owner: string; repo: string; path: string; ref: string },
): Promise<string | null> {
  try {
    const contents = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", opts);
    const b64 = (contents.data as any)?.content;
    if (!b64 || typeof b64 !== "string") return null;
    return Buffer.from(b64, "base64").toString("utf8");
  } catch (e: any) {
    const status = Number(e?.status ?? e?.response?.status ?? 0);
    if (status === 404) return null;
    throw e;
  }
}

async function withConcurrency<T>(
  n: number,
  items: T[],
  fn: (item: T) => Promise<void>,
) {
  const queue = [...items];
  const workers = Array.from({ length: n }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) return;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

type PolicyRule =
  | { type: "no_deprecated" }
  | { type: "max_stale_releases_count"; max: number }
  | { type: "max_bus_factor_low_count"; max: number };

type PolicyRow = {
  id: string;
  owner: string;
  name: string;
  enabled: boolean;
  rules: PolicyRule[];
};

async function evaluatePoliciesForScan(opts: { repoId: string; scanId: string; result: any }) {
  const owner = opts.repoId.includes("/") ? opts.repoId.split("/")[0] : opts.repoId;
  if (!owner) return;

  const { rows } = await db.query(
    "SELECT id, owner, name, enabled, rules FROM policies WHERE owner=$1 AND enabled=true ORDER BY created_at DESC",
    [owner],
  );
  if (!rows.length) return;

  const policies = rows as PolicyRow[];
  const signalsById = indexSignalsById(Array.isArray(opts.result?.signals) ? opts.result.signals : []);

  for (const p of policies) {
    const violations = evaluatePolicy(p, { repoId: opts.repoId, scanId: opts.scanId, signalsById });
    if (violations.length === 0) continue;
    for (const v of violations) {
      await db.query(
        "INSERT INTO policy_violations (id, policy_id, owner, repo_id, fingerprint, severity, title, details) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT (policy_id, repo_id, fingerprint) DO NOTHING",
        [
          randomUUID(),
          p.id,
          owner,
          opts.repoId,
          v.fingerprint,
          v.severity,
          v.title,
          JSON.stringify(v.details),
        ],
      );
    }
  }
}

function evaluatePolicy(
  policy: PolicyRow,
  ctx: { repoId: string; scanId: string; signalsById: Record<string, any> },
) {
  const out: Array<{
    fingerprint: string;
    severity: "low" | "medium" | "high";
    title: string;
    details: any;
  }> = [];

  const deprecatedCount = toNumber(ctx.signalsById["health.deprecated_count"]?.value);
  const staleCount = toNumber(ctx.signalsById["health.stale_releases_count"]?.value);
  const busLowCount = toNumber(ctx.signalsById["health.bus_factor_low_count"]?.value);

  for (const r of Array.isArray(policy.rules) ? policy.rules : []) {
    if (r.type === "no_deprecated") {
      if (deprecatedCount !== null && deprecatedCount > 0) {
        out.push({
          fingerprint: `no_deprecated:${deprecatedCount}`,
          severity: "high",
          title: `Policy violation: deprecated dependencies (${deprecatedCount})`,
          details: { policy: policy.name, rule: r, signalId: "health.deprecated_count", value: deprecatedCount },
        });
      }
    } else if (r.type === "max_stale_releases_count") {
      if (staleCount !== null && staleCount > r.max) {
        out.push({
          fingerprint: `max_stale_releases_count:${r.max}:${staleCount}`,
          severity: "medium",
          title: `Policy violation: stale releases count ${staleCount} > ${r.max}`,
          details: { policy: policy.name, rule: r, signalId: "health.stale_releases_count", value: staleCount },
        });
      }
    } else if (r.type === "max_bus_factor_low_count") {
      if (busLowCount !== null && busLowCount > r.max) {
        out.push({
          fingerprint: `max_bus_factor_low_count:${r.max}:${busLowCount}`,
          severity: "medium",
          title: `Policy violation: low bus-factor deps ${busLowCount} > ${r.max}`,
          details: { policy: policy.name, rule: r, signalId: "health.bus_factor_low_count", value: busLowCount },
        });
      }
    }
  }

  return out;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function applyTierLimitsToScanResult(result: any, limits: ReturnType<typeof getLimitsForOwner>): any {
  // Apply tier-based limits to scan result to reduce verbosity for lower tiers
  const limited = { ...result };

  // Limit findings
  if (Array.isArray(limited.findings) && limits.engineMaxFindings > 0) {
    limited.findings = limited.findings.slice(0, limits.engineMaxFindings);
  }

  // Limit recommendations
  if (Array.isArray(limited.recommendations) && limits.engineMaxRecommendations > 0) {
    limited.recommendations = limited.recommendations.slice(0, limits.engineMaxRecommendations);
  }

  // Limit graph insights
  if (limited.graphInsights) {
    const insights = { ...limited.graphInsights };
    
    if (Array.isArray(insights.deepest) && limits.engineMaxDeepestDeps > 0) {
      insights.deepest = insights.deepest.slice(0, limits.engineMaxDeepestDeps);
    }
    
    if (Array.isArray(insights.hotspots) && limits.engineMaxHotspots > 0) {
      insights.hotspots = insights.hotspots.slice(0, limits.engineMaxHotspots);
    }
    
    if (Array.isArray(insights.vulnerable) && limits.engineMaxVulnerable > 0) {
      insights.vulnerable = insights.vulnerable.slice(0, limits.engineMaxVulnerable);
    }
    
    limited.graphInsights = insights;
  }

  return limited;
}
