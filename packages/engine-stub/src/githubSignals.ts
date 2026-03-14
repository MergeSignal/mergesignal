import type { Finding, Recommendation, RiskSignal } from "@reposentinel/shared";
import type { PackageHealthObservation } from "@reposentinel/shared";
import { fetchJsonCached } from "./http.js";

type GithubRepo = {
  full_name?: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  pushed_at?: string;
  archived?: boolean;
  disabled?: boolean;
};

type RepoRef = { owner: string; repo: string; full: string };

export async function githubSignalsFromPackageHealth(observations: PackageHealthObservation[]): Promise<{
  signals: RiskSignal[];
  findings: Finding[];
  recommendations: Recommendation[];
}> {
  const enable = (process.env.REPOSENTINEL_ENABLE_GITHUB_SIGNALS ?? "0") === "1";
  if (!enable) return { signals: [], findings: [], recommendations: [] };

  const token = (process.env.REPOSENTINEL_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? "").trim();
  if (!token) return { signals: [], findings: [], recommendations: [] };

  const maxRepos = clampInt(process.env.REPOSENTINEL_GITHUB_MAX_REPOS, 10);
  const timeoutMs = clampInt(process.env.REPOSENTINEL_GITHUB_TIMEOUT_MS, 2500);
  const ttlMs = clampInt(process.env.REPOSENTINEL_GITHUB_CACHE_TTL_MS, 6 * 60 * 60 * 1000);

  const refs = uniqueRepos(
    (observations ?? [])
      .map((o) => parseGithubRepo(o.repositoryUrl ?? null))
      .filter(Boolean) as RepoRef[],
  ).slice(0, maxRepos);

  if (!refs.length) return { signals: [], findings: [], recommendations: [] };

  const repos = await mapLimit(refs, 4, async (r) => {
    try {
      const url = `https://api.github.com/repos/${r.owner}/${r.repo}`;
      const data = await fetchJsonCached<GithubRepo>(`gh:repo:${r.full}`, url, {
        ttlMs,
        timeoutMs,
        headers: {
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          Accept: "application/vnd.github+json",
        },
      });
      return { ref: r, data };
    } catch {
      return { ref: r, data: null as any };
    }
  });

  const ok = repos.filter((x) => x.data) as Array<{ ref: RepoRef; data: GithubRepo }>;
  if (!ok.length) return { signals: [], findings: [], recommendations: [] };

  const now = Date.now();
  const staleDays = clampInt(process.env.REPOSENTINEL_GITHUB_STALE_PUSH_DAYS, 180);

  const stale = ok.filter((x) => daysSince(x.data.pushed_at ?? null, now) >= staleDays);
  const archived = ok.filter((x) => Boolean(x.data.archived) || Boolean(x.data.disabled));

  const signals: RiskSignal[] = [];
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];

  signals.push({
    id: "github.enriched_repos",
    layer: "ecosystem",
    name: "Dependencies enriched with GitHub repo metadata",
    value: ok.length,
    weight: 1,
    scoreImpact: 0,
    evidence: { requested: refs.length, enriched: ok.length },
  });

  signals.push({
    id: "github.stale_push_repos_count",
    layer: "maintainability",
    name: "Dependencies with stale maintainer activity (GitHub push recency)",
    value: stale.length,
    weight: 1,
    scoreImpact: clampScore((stale.length / Math.max(1, ok.length)) * 30),
    evidence: { staleDays, top: stale.slice(0, 5).map(slimRepo) },
  });

  signals.push({
    id: "github.archived_or_disabled_repos_count",
    layer: "maintainability",
    name: "Archived/disabled dependency repositories (GitHub)",
    value: archived.length,
    weight: 1,
    scoreImpact: clampScore((archived.length / Math.max(1, ok.length)) * 45),
    evidence: { top: archived.slice(0, 5).map(slimRepo) },
  });

  // Open issues is noisy (includes PRs); still useful as a coarse signal.
  const highOpenIssues = ok
    .map((x) => ({
      full: x.ref.full,
      openIssues: Number(x.data.open_issues_count ?? 0),
      stars: Number(x.data.stargazers_count ?? 0),
    }))
    .filter((x) => Number.isFinite(x.openIssues) && x.openIssues >= 200)
    .sort((a, b) => b.openIssues - a.openIssues)
    .slice(0, 5);

  signals.push({
    id: "github.high_open_issues_repos_count",
    layer: "maintainability",
    name: "High open issues repositories (GitHub)",
    value: highOpenIssues.length,
    weight: 1,
    scoreImpact: clampScore((highOpenIssues.length / Math.max(1, ok.length)) * 15),
    evidence: { top: highOpenIssues },
  });

  if (archived.length) {
    findings.push({
      id: "archived-deps",
      title: "Archived dependency repositories detected",
      description: "Archived or disabled repositories are higher abandonment risk and may block upgrades or fixes.",
      severity: "high",
      packageName: "dependency",
      recommendation: "Prioritize replacing archived dependencies, especially those with high fan-in or blast radius.",
    });
  }

  if (stale.length) {
    recommendations.push({
      id: "review-stale-github",
      title: "Review dependencies with low maintainer activity",
      rationale: "Stale repositories may lag behind security/compatibility updates and increase long-term maintenance cost.",
      impact: "medium",
      priorityScore: 50,
      estimatedScoreDelta: -Math.min(12, stale.length * 2),
      layers: ["maintainability", "ecosystem"],
      evidence: { staleDays, top: stale.slice(0, 5).map(slimRepo) },
    });
  }

  return { signals, findings, recommendations };
}

function parseGithubRepo(url: string | null): RepoRef | null {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;

  // examples:
  // https://github.com/owner/repo
  // git+https://github.com/owner/repo.git
  // git://github.com/owner/repo.git
  const m = s.match(/github\.com[:/]+([^/]+)\/([^/#]+)(?:[#/].*)?$/i);
  if (!m) return null;
  const owner = m[1] ? m[1].trim() : "";
  const repo = m[2] ? m[2].replace(/\.git$/i, "").trim() : "";
  if (!owner || !repo) return null;
  return { owner, repo, full: `${owner}/${repo}` };
}

function uniqueRepos(xs: RepoRef[]) {
  const seen = new Set<string>();
  const out: RepoRef[] = [];
  for (const x of xs) {
    const k = x.full.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function slimRepo(x: { ref: RepoRef; data: GithubRepo }) {
  return {
    repo: x.ref.full,
    stars: x.data.stargazers_count ?? null,
    openIssues: x.data.open_issues_count ?? null,
    pushedAt: x.data.pushed_at ?? null,
    archived: Boolean(x.data.archived),
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) return;
      out.push(await fn(item));
    }
  });
  await Promise.all(workers);
  return out;
}

function daysSince(iso: string | null, nowMs: number): number {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Infinity;
  return Math.floor((nowMs - t) / (24 * 60 * 60 * 1000));
}

function clampInt(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

