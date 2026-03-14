import type { Finding, PackageHealthObservation, Recommendation, RiskSignal, ScoreLayer } from "@reposentinel/shared";
import type { DependencyGraph } from "./pnpmLock.js";
import { fetchJsonCached } from "./http.js";

type NpmDoc = {
  "dist-tags"?: { latest?: string };
  time?: Record<string, string>;
  versions?: Record<string, { deprecated?: string; repository?: { url?: string } | string }>;
  maintainers?: Array<{ name?: string; email?: string }>;
  repository?: { url?: string } | string;
};

type NpmMeta = {
  name: string;
  latestVersion: string | null;
  latestPublishedAt: string | null;
  modifiedAt: string | null;
  deprecated: boolean;
  maintainersCount: number | null;
  repositoryUrl: string | null;
};

export async function repoHealthFromGraph(graph: DependencyGraph): Promise<{
  signals: RiskSignal[];
  findings: Finding[];
  recommendations: Recommendation[];
  dataset: { packageHealth: PackageHealthObservation[] };
}> {
  const enable = (process.env.REPOSENTINEL_ENABLE_REPO_HEALTH ?? "1") === "1";
  if (!enable) return { signals: [], findings: [], recommendations: [], dataset: { packageHealth: [] } };

  const maxPackages = clampInt(process.env.REPOSENTINEL_HEALTH_MAX_PACKAGES, 25);
  const timeoutMs = clampInt(process.env.REPOSENTINEL_HEALTH_TIMEOUT_MS, 2500);
  const ttlMs = clampInt(process.env.REPOSENTINEL_HEALTH_CACHE_TTL_MS, 6 * 60 * 60 * 1000);
  const staleDays = clampInt(process.env.REPOSENTINEL_HEALTH_STALE_DAYS, 365);
  const veryStaleDays = clampInt(process.env.REPOSENTINEL_HEALTH_VERY_STALE_DAYS, 730);

  const candidates = uniqueByName([
    ...Object.keys(graph.directDeps).map((name) => ({ name })),
    ...graph.blastRadiusTop.map((x) => ({ name: x.name })),
    ...graph.fanInTop.map((x) => ({ name: x.name })),
  ]).slice(0, maxPackages);

  const metas = await mapLimit(candidates, 5, async ({ name }) => {
    try {
      return await fetchNpmMeta(name, { ttlMs, timeoutMs });
    } catch {
      return null;
    }
  });

  const ok = metas.filter(Boolean) as NpmMeta[];
  if (ok.length === 0) return { signals: [], findings: [], recommendations: [], dataset: { packageHealth: [] } };

  const now = Date.now();
  const deprecated = ok.filter((m) => m.deprecated);
  const stale = ok.filter((m) => daysSince(m.latestPublishedAt, now) >= staleDays);
  const veryStale = ok.filter((m) => daysSince(m.latestPublishedAt, now) >= veryStaleDays);
  const singleMaintainer = ok.filter((m) => (m.maintainersCount ?? 0) <= 1);

  const signals: RiskSignal[] = [];
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];

  addSignal(signals, {
    id: "health.enriched_packages",
    layer: "ecosystem",
    name: "Repository health enrichment coverage",
    value: ok.length,
    weight: 1,
    scoreImpact: 0,
    evidence: { requested: candidates.length, enriched: ok.length },
  });

  addSignal(signals, {
    id: "health.deprecated_count",
    layer: "security",
    name: "Deprecated dependencies",
    value: deprecated.length,
    weight: 1,
    scoreImpact: clampScore((deprecated.length / Math.max(1, ok.length)) * 40),
    evidence: { top: deprecated.slice(0, 5).map(slimMeta) },
  });

  addSignal(signals, {
    id: "health.stale_releases_count",
    layer: "ecosystem",
    name: "Stale releases",
    value: stale.length,
    weight: 1,
    scoreImpact: clampScore((stale.length / Math.max(1, ok.length)) * 30),
    evidence: { staleDays, top: stale.slice(0, 5).map(slimMeta) },
  });

  addSignal(signals, {
    id: "health.bus_factor_low_count",
    layer: "maintainability",
    name: "Low maintainer count (bus factor)",
    value: singleMaintainer.length,
    weight: 1,
    scoreImpact: clampScore((singleMaintainer.length / Math.max(1, ok.length)) * 25),
    evidence: { top: singleMaintainer.slice(0, 5).map(slimMeta) },
  });

  if (deprecated.length) {
    findings.push({
      id: "deprecated-deps",
      title: "Deprecated dependencies detected",
      description: "Deprecated packages can carry unpatched risk and often require migration planning.",
      severity: "high",
      packageName: deprecated[0].name,
      recommendation: "Prioritize replacing deprecated dependencies, starting with those in critical paths.",
    });

    recommendations.push({
      id: "replace-deprecated",
      title: "Replace deprecated dependencies",
      rationale: "Deprecated packages are a strong long-term risk signal and can block upgrades.",
      impact: "high",
      priorityScore: 95,
      estimatedScoreDelta: -Math.min(25, deprecated.length * 5),
      layers: ["security", "upgradeImpact"],
      packages: deprecated.slice(0, 10).map((m) => m.name),
      evidence: { top: deprecated.slice(0, 5).map(slimMeta) },
    });
  }

  if (veryStale.length) {
    findings.push({
      id: "very-stale-deps",
      title: "Very stale dependencies detected",
      description: "Packages with infrequent releases may indicate low maintenance or ecosystem risk.",
      severity: "medium",
      packageName: veryStale[0].name,
      recommendation: "Review stale dependencies and consider alternatives for the most critical ones.",
    });

    recommendations.push({
      id: "review-stale",
      title: "Review stale dependencies for alternatives",
      rationale: "Stale packages may accumulate unaddressed issues and increase long-term maintenance cost.",
      impact: "medium",
      priorityScore: 60,
      estimatedScoreDelta: -Math.min(15, veryStale.length * 2),
      layers: ["ecosystem", "maintainability"],
      packages: veryStale.slice(0, 10).map((m) => m.name),
      evidence: { veryStaleDays, top: veryStale.slice(0, 5).map(slimMeta) },
    });
  }

  if (singleMaintainer.length) {
    recommendations.push({
      id: "mitigate-bus-factor",
      title: "Mitigate single-maintainer dependency risk",
      rationale: "Dependencies maintained by a single person can become a bottleneck or abruptly unmaintained.",
      impact: "medium",
      priorityScore: 50,
      estimatedScoreDelta: -Math.min(10, singleMaintainer.length),
      layers: ["maintainability", "ecosystem"],
      packages: singleMaintainer.slice(0, 10).map((m) => m.name),
      evidence: { top: singleMaintainer.slice(0, 5).map(slimMeta) },
    });
  }

  return { signals, findings, recommendations, dataset: { packageHealth: ok.map(toObservation) } };
}

function toObservation(m: NpmMeta): PackageHealthObservation {
  return {
    name: m.name,
    registry: "npm",
    fetchedAt: new Date().toISOString(),
    latestVersion: m.latestVersion,
    latestPublishedAt: m.latestPublishedAt,
    modifiedAt: m.modifiedAt,
    deprecated: m.deprecated,
    maintainersCount: m.maintainersCount,
    repositoryUrl: m.repositoryUrl,
  };
}

async function fetchNpmMeta(
  name: string,
  { ttlMs, timeoutMs }: { ttlMs: number; timeoutMs: number },
): Promise<NpmMeta> {
  const encoded = encodeURIComponent(name).replace(/^%40/, "@");
  const url = `https://registry.npmjs.org/${encoded}`;
  const doc = await fetchJsonCached<NpmDoc>(`npm:${name}`, url, {
    ttlMs,
    timeoutMs,
    headers: {
      "Accept": "application/vnd.npm.install-v1+json",
    },
  });

  const latest = doc?.["dist-tags"]?.latest ?? null;
  const time = doc?.time ?? {};
  const latestPublishedAt = latest && time[latest] ? String(time[latest]) : null;
  const modifiedAt = time?.modified ? String(time.modified) : null;
  const versionDoc = latest ? doc?.versions?.[latest] : undefined;
  const deprecated = Boolean(versionDoc?.deprecated);
  const maintainersCount = Array.isArray(doc?.maintainers) ? doc.maintainers.length : null;

  const repositoryUrl = normalizeRepositoryUrl(
    (typeof versionDoc?.repository === "string"
      ? versionDoc.repository
      : versionDoc?.repository?.url) ??
      (typeof doc.repository === "string" ? doc.repository : doc.repository?.url) ??
      null,
  );

  return {
    name,
    latestVersion: latest,
    latestPublishedAt,
    modifiedAt,
    deprecated,
    maintainersCount,
    repositoryUrl,
  };
}

function normalizeRepositoryUrl(url: string | null): string | null {
  if (!url) return null;
  const u = String(url).trim();
  if (!u) return null;
  const cleaned = u.replace(/^git\+/, "").replace(/\.git$/, "");
  return cleaned;
}

function daysSince(iso: string | null, nowMs: number): number {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Infinity;
  return Math.floor((nowMs - t) / (24 * 60 * 60 * 1000));
}

function slimMeta(m: NpmMeta) {
  return {
    name: m.name,
    latestVersion: m.latestVersion,
    latestPublishedAt: m.latestPublishedAt,
    deprecated: m.deprecated,
    maintainersCount: m.maintainersCount,
    repositoryUrl: m.repositoryUrl,
  };
}

function addSignal(arr: RiskSignal[], s: RiskSignal) {
  arr.push(s);
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampInt(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function uniqueByName(xs: Array<{ name: string }>) {
  const seen = new Set<string>();
  const out: Array<{ name: string }> = [];
  for (const x of xs) {
    const k = x.name;
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ name: k });
  }
  return out;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;

  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });

  await Promise.all(workers);
  return out;
}

