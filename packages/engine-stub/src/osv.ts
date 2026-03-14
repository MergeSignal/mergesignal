import type { Finding, Recommendation, RiskSignal } from "@reposentinel/shared";
import type { DependencyGraph } from "./pnpmLock.js";
import { postJsonCached } from "./http.js";

type OsvSeverity = { type?: string; score?: string };

type OsvVuln = {
  id?: string;
  summary?: string;
  details?: string;
  severity?: OsvSeverity[];
};

type OsvQueryBatchResponse = {
  results?: Array<{ vulns?: OsvVuln[] | null } | null>;
};

type Candidate = { name: string; version: string };

export async function osvVulnerabilitiesFromGraph(graph: DependencyGraph): Promise<{
  signals: RiskSignal[];
  findings: Finding[];
  recommendations: Recommendation[];
}> {
  const enable = (process.env.REPOSENTINEL_ENABLE_OSV ?? "1") === "1";
  if (!enable) return { signals: [], findings: [], recommendations: [] };

  const maxPackages = clampInt(process.env.REPOSENTINEL_OSV_MAX_PACKAGES, 25);
  const timeoutMs = clampInt(process.env.REPOSENTINEL_OSV_TIMEOUT_MS, 3000);
  const ttlMs = clampInt(process.env.REPOSENTINEL_OSV_CACHE_TTL_MS, 24 * 60 * 60 * 1000);

  const candidates = uniqueCandidates([
    ...Object.entries(graph.directDeps).map(([name, version]) => ({ name, version })),
    ...graph.fanInTop.map((x) => ({ name: x.name, version: x.version })),
    ...graph.blastRadiusTop.map((x) => ({ name: x.name, version: x.version })),
  ]).slice(0, maxPackages);

  if (candidates.length === 0) return { signals: [], findings: [], recommendations: [] };

  const body = {
    queries: candidates.map((c) => ({
      package: { ecosystem: "npm", name: c.name },
      version: c.version,
    })),
  };

  const key = `osv:batch:${candidates.map((c) => `${c.name}@${c.version}`).join("|")}`;
  const url = "https://api.osv.dev/v1/querybatch";
  let resp: OsvQueryBatchResponse;
  try {
    resp = await postJsonCached<OsvQueryBatchResponse>(key, url, body, { ttlMs, timeoutMs });
  } catch (e: any) {
    return {
      signals: [
        {
          id: "vuln.osv_unavailable",
          layer: "security",
          name: "OSV vulnerability enrichment unavailable",
          value: 1,
          weight: 1,
          scoreImpact: 0,
          evidence: {
            timeoutMs,
            requested: candidates.length,
            error: String(e?.message ?? e),
          },
        },
      ],
      findings: [],
      recommendations: [],
    };
  }

  const results = Array.isArray(resp?.results) ? resp.results : [];
  const affected: Array<{
    name: string;
    version: string;
    count: number;
    worstScore: number | null;
    topIds: string[];
  }> = [];

  let totalVulns = 0;
  let highOrCritical = 0;

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i]!;
    const vulns = (results[i] as any)?.vulns;
    const arr = Array.isArray(vulns) ? (vulns as OsvVuln[]) : [];
    if (!arr.length) continue;

    totalVulns += arr.length;
    const scores = arr.map(getWorstCvssScore).filter((x) => typeof x === "number") as number[];
    const worst = scores.length ? Math.max(...scores) : null;
    if (worst !== null && worst >= 7) highOrCritical += 1;

    affected.push({
      name: cand.name,
      version: cand.version,
      count: arr.length,
      worstScore: worst,
      topIds: arr
        .map((v) => String(v?.id ?? ""))
        .filter(Boolean)
        .slice(0, 3),
    });
  }

  const signals: RiskSignal[] = [];
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];

  signals.push({
    id: "vuln.osv_scanned_packages",
    layer: "security",
    name: "Packages checked for known vulnerabilities (OSV)",
    value: candidates.length,
    weight: 1,
    scoreImpact: 0,
    evidence: { requested: candidates.length, affectedPackages: affected.length },
  });

  signals.push({
    id: "vuln.osv_total_vulns",
    layer: "security",
    name: "Known vulnerabilities (OSV) across selected packages",
    value: totalVulns,
    weight: 1,
    scoreImpact: clampScore((totalVulns / 10) * 45),
    evidence: { top: affected.sort((a, b) => b.count - a.count).slice(0, 5) },
  });

  signals.push({
    id: "vuln.osv_high_severity_packages",
    layer: "security",
    name: "Packages with high-severity vulnerabilities (CVSS>=7 when available)",
    value: highOrCritical,
    weight: 1,
    scoreImpact: clampScore((highOrCritical / 3) * 40),
    evidence: { top: affected.filter((a) => (a.worstScore ?? 0) >= 7).slice(0, 5) },
  });

  if (affected.length) {
    const top = [...affected].sort((a, b) => (b.worstScore ?? 0) - (a.worstScore ?? 0) || b.count - a.count)[0]!;
    findings.push({
      id: "known-vulns",
      title: "Known vulnerabilities found in dependencies",
      description:
        "Some dependencies match known vulnerability advisories (OSV). This is a signal to prioritize upgrades, patches, or mitigations.",
      severity: highOrCritical ? "high" : "medium",
      packageName: top.name,
      recommendation: "Prioritize upgrading or mitigating the most affected packages, starting with those in critical paths.",
    });

    const priorityScore = clampScore(60 + Math.min(40, totalVulns * 4));
    recommendations.push({
      id: "patch-known-vulns",
      title: "Upgrade or mitigate known vulnerabilities",
      rationale: "Known vulnerabilities increase exploit and supply-chain risk; upgrading is often the fastest mitigation.",
      impact: priorityScore >= 80 ? "high" : "medium",
      priorityScore,
      estimatedScoreDelta: -Math.min(40, totalVulns * 4),
      layers: ["security", "upgradeImpact"],
      packages: affected
        .sort((a, b) => (b.worstScore ?? 0) - (a.worstScore ?? 0) || b.count - a.count)
        .slice(0, 10)
        .map((x) => x.name),
      evidence: { top: affected.slice(0, 5) },
    });
  }

  return { signals, findings, recommendations };
}

function getWorstCvssScore(v: OsvVuln): number | null {
  const sev = Array.isArray(v?.severity) ? v.severity : [];
  const scores = sev
    .map((s) => (s?.score ? Number(s.score) : NaN))
    .filter((n) => Number.isFinite(n)) as number[];
  if (!scores.length) return null;
  return Math.max(...scores);
}

function uniqueCandidates(xs: Candidate[]) {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const x of xs) {
    const name = String(x?.name ?? "").trim();
    const version = String(x?.version ?? "").trim();
    if (!name || !version) continue;
    const key = `${name}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, version });
  }
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

