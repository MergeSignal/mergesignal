import type { Finding, Recommendation, RiskSignal } from "@reposentinel/shared";
import type { DependencyGraph } from "./pnpmLock.js";
import { fetchJsonCached } from "./http.js";

type NpmDownloadsPoint = {
  downloads?: number;
  start?: string;
  end?: string;
  package?: string;
};

type Candidate = { name: string };

export async function adoptionSignalsFromGraph(graph: DependencyGraph): Promise<{
  signals: RiskSignal[];
  findings: Finding[];
  recommendations: Recommendation[];
}> {
  const enable = (process.env.REPOSENTINEL_ENABLE_ADOPTION ?? "1") === "1";
  if (!enable) return { signals: [], findings: [], recommendations: [] };

  const maxPackages = clampInt(process.env.REPOSENTINEL_ADOPTION_MAX_PACKAGES, 25);
  const timeoutMs = clampInt(process.env.REPOSENTINEL_ADOPTION_TIMEOUT_MS, 2500);
  const ttlMs = clampInt(process.env.REPOSENTINEL_ADOPTION_CACHE_TTL_MS, 24 * 60 * 60 * 1000);
  const lowThreshold = clampInt(process.env.REPOSENTINEL_ADOPTION_LOW_DOWNLOADS, 5_000);
  const veryLowThreshold = clampInt(process.env.REPOSENTINEL_ADOPTION_VERY_LOW_DOWNLOADS, 500);

  const candidates = uniqueByName([
    ...Object.keys(graph.directDeps).map((name) => ({ name })),
    ...graph.blastRadiusTop.map((x) => ({ name: x.name })),
    ...graph.fanInTop.map((x) => ({ name: x.name })),
  ]).slice(0, maxPackages);

  if (!candidates.length) return { signals: [], findings: [], recommendations: [] };

  const points = await mapLimit(candidates, 5, async ({ name }) => {
    try {
      const encoded = encodeURIComponent(name).replace(/^%40/, "@");
      const url = `https://api.npmjs.org/downloads/point/last-month/${encoded}`;
      const p = await fetchJsonCached<NpmDownloadsPoint>(`npm:downloads:${name}`, url, {
        ttlMs,
        timeoutMs,
      });
      const downloads = Number(p?.downloads ?? NaN);
      return { name, downloads: Number.isFinite(downloads) ? downloads : null };
    } catch {
      return { name, downloads: null };
    }
  });

  const known = points.filter((p) => typeof p.downloads === "number") as Array<{
    name: string;
    downloads: number;
  }>;

  const veryLow = known.filter((p) => p.downloads < veryLowThreshold);
  const low = known.filter((p) => p.downloads < lowThreshold);

  const signals: RiskSignal[] = [];
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];

  signals.push({
    id: "adoption.downloads_enriched_packages",
    layer: "ecosystem",
    name: "Packages enriched with npm download counts",
    value: known.length,
    weight: 1,
    scoreImpact: 0,
    evidence: { requested: candidates.length, enriched: known.length },
  });

  signals.push({
    id: "adoption.low_downloads_count",
    layer: "ecosystem",
    name: "Low adoption dependencies (npm downloads)",
    value: low.length,
    weight: 1,
    scoreImpact: clampScore((low.length / Math.max(1, known.length)) * 25),
    evidence: { lowThreshold, top: low.sort((a, b) => a.downloads - b.downloads).slice(0, 5) },
  });

  signals.push({
    id: "adoption.very_low_downloads_count",
    layer: "ecosystem",
    name: "Very low adoption dependencies (npm downloads)",
    value: veryLow.length,
    weight: 1,
    scoreImpact: clampScore((veryLow.length / Math.max(1, known.length)) * 35),
    evidence: {
      veryLowThreshold,
      top: veryLow.sort((a, b) => a.downloads - b.downloads).slice(0, 5),
    },
  });

  if (veryLow.length) {
    const top = veryLow.sort((a, b) => a.downloads - b.downloads)[0]!;
    findings.push({
      id: "low-adoption",
      title: "Low adoption dependencies detected",
      description:
        "Very low adoption can increase ecosystem risk (fewer maintainers/users, less review, and higher abandonment probability).",
      severity: "medium",
      packageName: top.name,
      recommendation: "Review low-adoption dependencies and consider more established alternatives when feasible.",
    });

    recommendations.push({
      id: "review-low-adoption",
      title: "Review low-adoption dependencies for alternatives",
      rationale: "Higher adoption tends to correlate with stronger ecosystem support and faster issue discovery.",
      impact: "medium",
      priorityScore: 55,
      estimatedScoreDelta: -Math.min(12, veryLow.length * 2),
      layers: ["ecosystem", "maintainability"],
      packages: veryLow.slice(0, 10).map((x) => x.name),
      evidence: { veryLowThreshold, top: veryLow.slice(0, 5) },
    });
  }

  return { signals, findings, recommendations };
}

function uniqueByName(xs: Candidate[]) {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const x of xs) {
    const name = String(x?.name ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name });
  }
  return out;
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

function clampInt(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

