import type {
  Finding,
  LayerScores,
  Recommendation,
  RiskSignal,
  ScanRequest,
  ScanResult,
  ScoreContribution,
  ScoreLayer,
} from "@reposentinel/shared";
import { graphFromPnpmLockfile } from "./pnpmLock.js";
import { repoHealthFromGraph } from "./repoHealth.js";

export async function analyze(req: ScanRequest): Promise<ScanResult> {
  const derivedGraph =
    req.lockfile?.manager === "pnpm" && typeof req.lockfile.content === "string"
      ? graphFromPnpmLockfile(req.lockfile.content)
      : null;

  const stats = deriveDependencyStats(derivedGraph ?? req.dependencyGraph);
  const baseSignals = buildSignals(stats);
  const baseFindings = buildFindings(stats);
  const baseRecommendations = buildRecommendations(stats);

  const health = derivedGraph ? await repoHealthFromGraph(derivedGraph) : null;

  const signals = [...baseSignals, ...(health?.signals ?? [])];
  const findings = [...baseFindings, ...(health?.findings ?? [])];
  const recommendations = finalizeRecommendations([
    ...baseRecommendations,
    ...(health?.recommendations ?? []),
  ]);

  const layerScores = computeLayerScores(signals);
  const totalScore = computeTotalScore(layerScores);

  return {
    totalScore,
    layerScores,
    findings,
    methodologyVersion: "engine-stub/v2",
    confidence: stats.hasGraphLikeShape ? "medium" : "low",
    signals,
    contributions: signalsToContributions(signals),
    recommendations,
    dataset: health?.dataset,
    generatedAt: new Date().toISOString(),
  };
}

type DependencyStats = {
  hasGraphLikeShape: boolean;
  nodeCount: number;
  edgeCount: number;
  directDepsCount: number;
  maxDepthEstimate: number;
  duplicateVersionPackages: number;
  duplicateTop: Array<{ name: string; versions: string[] }>;
  fanInMax: number;
  fanInTop: Array<{ name: string; version: string; fanIn: number }>;
  blastRadiusMax: number;
  blastRadiusTop: Array<{ name: string; version: string; roots: number }>;
};

function deriveDependencyStats(input: unknown): DependencyStats {
  const empty: DependencyStats = {
    hasGraphLikeShape: false,
    nodeCount: 0,
    edgeCount: 0,
    directDepsCount: 0,
    maxDepthEstimate: 0,
    duplicateVersionPackages: 0,
    duplicateTop: [],
    fanInMax: 0,
    fanInTop: [],
    blastRadiusMax: 0,
    blastRadiusTop: [],
  };

  if (!input || typeof input !== "object") return empty;

  const obj = input as Record<string, unknown>;

  const nodesArr = Array.isArray(obj.nodes) ? (obj.nodes as unknown[]) : undefined;
  const edgesArr = Array.isArray(obj.edges) ? (obj.edges as unknown[]) : undefined;

  const deps = (obj.dependencies ??
    obj.deps ??
    obj.packages) as Record<string, unknown> | undefined;

  const nodeCount =
    (nodesArr?.length ?? 0) || (deps && typeof deps === "object" ? Object.keys(deps).length : 0);

  const edgeCount = edgesArr?.length ?? 0;

  const directDepsObj =
    (typeof (obj as any).directDeps === "object" && (obj as any).directDeps) ||
    (typeof (obj as any).directDependencies === "object" && (obj as any).directDependencies) ||
    null;

  const directDepsCount = directDepsObj ? Object.keys(directDepsObj as any).length : 0;

  const versionsByName =
    typeof obj.versionsByName === "object" && obj.versionsByName
      ? (obj.versionsByName as Record<string, unknown>)
      : undefined;

  const duplicateVersionPackages = versionsByName
    ? Object.values(versionsByName).filter((v) => Array.isArray(v) && v.length > 1).length
    : 0;

  const duplicateTop = versionsByName
    ? Object.entries(versionsByName)
        .map(([name, versions]) => ({
          name,
          versions: Array.isArray(versions) ? (versions as unknown[]).map(String) : [],
        }))
        .filter((x) => x.versions.length > 1)
        .sort((a, b) => b.versions.length - a.versions.length)
        .slice(0, 10)
    : [];

  const fanInTopRaw = Array.isArray(obj.fanInTop) ? (obj.fanInTop as any[]) : [];
  const fanInTop = fanInTopRaw
    .map((x) => ({
      name: String(x?.name ?? ""),
      version: String(x?.version ?? ""),
      fanIn: Number(x?.fanIn ?? 0),
    }))
    .filter((x) => x.name && x.version && Number.isFinite(x.fanIn) && x.fanIn > 0)
    .sort((a, b) => b.fanIn - a.fanIn)
    .slice(0, 10);

  const fanInMax = fanInTop.length ? fanInTop[0].fanIn : 0;

  const blastRadiusTopRaw = Array.isArray(obj.blastRadiusTop)
    ? (obj.blastRadiusTop as any[])
    : [];
  const blastRadiusTop = blastRadiusTopRaw
    .map((x) => ({
      name: String(x?.name ?? ""),
      version: String(x?.version ?? ""),
      roots: Number(x?.roots ?? 0),
    }))
    .filter((x) => x.name && x.version && Number.isFinite(x.roots) && x.roots > 0)
    .sort((a, b) => b.roots - a.roots)
    .slice(0, 10);

  const blastRadiusMax = blastRadiusTop.length ? blastRadiusTop[0].roots : 0;

  const hasGraphLikeShape =
    Boolean(nodesArr) ||
    Boolean(edgesArr) ||
    (deps && typeof deps === "object") ||
    directDepsCount > 0;

  const maxDepthEstimate =
    typeof obj.maxDepth === "number"
      ? Math.max(0, Math.floor(obj.maxDepth))
      : Math.min(12, Math.floor(Math.log2(Math.max(1, nodeCount))));

  return {
    hasGraphLikeShape,
    nodeCount: Math.max(0, nodeCount),
    edgeCount: Math.max(0, edgeCount),
    directDepsCount: Math.max(0, directDepsCount),
    maxDepthEstimate: Math.max(0, maxDepthEstimate),
    duplicateVersionPackages: Math.max(0, duplicateVersionPackages),
    duplicateTop,
    fanInMax: Math.max(0, fanInMax),
    fanInTop,
    blastRadiusMax: Math.max(0, blastRadiusMax),
    blastRadiusTop,
  };
}

function buildSignals(stats: DependencyStats): RiskSignal[] {
  const signals: RiskSignal[] = [];

  const add = (
    id: string,
    layer: ScoreLayer,
    name: string,
    value: number,
    weight: number,
    scoreImpact: number,
    evidence?: Record<string, unknown>,
  ) => {
    signals.push({
      id,
      layer,
      name,
      value,
      weight,
      scoreImpact,
      evidence,
    });
  };

  add(
    "graph.transitive_volume",
    "maintainability",
    "Transitive dependency volume",
    stats.nodeCount,
    1,
    clampScore((stats.nodeCount / 200) * 35),
    { nodeCount: stats.nodeCount },
  );

  add(
    "graph.depth",
    "maintainability",
    "Dependency depth",
    stats.maxDepthEstimate,
    1,
    clampScore((stats.maxDepthEstimate / 10) * 25),
    { maxDepthEstimate: stats.maxDepthEstimate },
  );

  add(
    "graph.duplicates",
    "upgradeImpact",
    "Duplicate versions across packages",
    stats.duplicateVersionPackages,
    1,
    clampScore((stats.duplicateVersionPackages / 25) * 30),
    { duplicateVersionPackages: stats.duplicateVersionPackages },
  );

  add(
    "graph.fan_in_max",
    "upgradeImpact",
    "Transitive blast radius (max fan-in)",
    stats.fanInMax,
    1,
    clampScore((stats.fanInMax / 20) * 25),
    { top: stats.fanInTop.slice(0, 3) },
  );

  add(
    "graph.blast_radius_roots_max",
    "upgradeImpact",
    "Root blast radius (direct deps affected)",
    stats.blastRadiusMax,
    1,
    clampScore((stats.blastRadiusMax / 25) * 30),
    { top: stats.blastRadiusTop.slice(0, 3) },
  );

  add(
    "input.coverage",
    "security",
    "Input coverage confidence penalty",
    stats.hasGraphLikeShape ? 1 : 0,
    1,
    stats.hasGraphLikeShape ? 0 : 25,
    { hasGraphLikeShape: stats.hasGraphLikeShape },
  );

  add(
    "upgrade.direct_deps_count",
    "upgradeImpact",
    "Direct dependencies count",
    stats.directDepsCount,
    1,
    clampScore((stats.directDepsCount / 80) * 20),
    { directDepsCount: stats.directDepsCount },
  );

  add(
    "ecosystem.package_surface",
    "ecosystem",
    "Package surface area",
    stats.nodeCount,
    1,
    clampScore((stats.nodeCount / 250) * 20),
    { nodeCount: stats.nodeCount },
  );

  return signals;
}

function computeLayerScores(signals: RiskSignal[]): LayerScores {
  const base: LayerScores = {
    security: 0,
    maintainability: 0,
    ecosystem: 0,
    upgradeImpact: 0,
  };

  for (const s of signals) {
    base[s.layer] = clampScore(base[s.layer] + s.scoreImpact);
  }

  return base;
}

function computeTotalScore(layerScores: LayerScores): number {
  const weights: Record<ScoreLayer, number> = {
    security: 0.35,
    maintainability: 0.25,
    ecosystem: 0.15,
    upgradeImpact: 0.25,
  };

  let sum = 0;
  for (const layer of Object.keys(weights) as ScoreLayer[]) {
    sum += layerScores[layer] * weights[layer];
  }
  return clampScore(sum);
}

function signalsToContributions(signals: RiskSignal[]): ScoreContribution[] {
  return signals.map((s) => ({
    id: s.id,
    layer: s.layer,
    scoreImpact: s.scoreImpact,
    evidence: s.evidence,
  }));
}

function buildFindings(stats: DependencyStats): Finding[] {
  if (!stats.hasGraphLikeShape) {
    return [
      {
        id: "missing-input",
        title: "Limited input; confidence reduced",
        description:
          "No dependency graph or lockfile-derived graph was provided. Scores are conservative and based on minimal heuristics.",
        severity: "medium",
        packageName: "repository",
        recommendation: "Provide a lockfile (pnpm-lock.yaml or package-lock.json) for deeper analysis.",
      },
    ];
  }

  const findings: Finding[] = [
    {
      id: "engine-v1",
      title: "Explainable scoring enabled",
      description: "This scan includes per-signal score contributions and a methodology version.",
      severity: "low",
      packageName: "repository",
    },
  ];

  if (stats.fanInTop.length) {
    findings.push({
      id: "transitive-hotspots",
      title: "Transitive dependency hotspots detected",
      description:
        "Some transitive packages are depended on by many others, increasing blast radius for vulnerabilities and upgrades.",
      severity: "medium",
      packageName: stats.fanInTop[0].name,
      recommendation: "Prioritize monitoring and cautious upgrades for the highest fan-in transitive packages.",
    });
  }

  if (stats.blastRadiusTop.length) {
    findings.push({
      id: "blast-radius",
      title: "High blast radius dependencies detected",
      description:
        "Some transitive dependencies are reachable from a large fraction of your direct dependencies, so changes can have wide impact.",
      severity: "medium",
      packageName: stats.blastRadiusTop[0].name,
      recommendation: "Use smaller upgrade steps and validate with tests when touching the highest blast-radius packages.",
    });
  }

  return findings;
}

function buildRecommendations(stats: DependencyStats) {
  const recs: Recommendation[] = [];

  const push = (rec: Omit<Recommendation, "rank"> & { priorityScore: number }) => {
    recs.push(rec);
  };

  const impactFromPriority = (p: number): Recommendation["impact"] =>
    p >= 70 ? "high" : p >= 35 ? "medium" : "low";

  const clampDelta = (n: number) => Math.max(-100, Math.min(0, Math.round(n)));

  if (!stats.hasGraphLikeShape) {
    const priorityScore = 90;
    push({
      id: "provide-lockfile",
      title: "Add lockfile input for higher-fidelity results",
      rationale: "Lockfile parsing enables transitive graph intelligence and upgrade impact analysis.",
      impact: impactFromPriority(priorityScore),
      priorityScore,
      estimatedScoreDelta: clampDelta(-25),
      layers: ["security", "maintainability", "upgradeImpact"],
    });
    return recs;
  }

  if (stats.duplicateVersionPackages > 0) {
    const priorityScore = clampScore((stats.duplicateVersionPackages / 25) * 80);
    push({
      id: "dedupe-versions",
      title: "Reduce duplicate dependency versions",
      rationale: "Fewer duplicate versions lowers upgrade complexity and reduces bundle/runtime surface area.",
      impact: impactFromPriority(priorityScore),
      priorityScore,
      estimatedScoreDelta: clampDelta(-clampScore((stats.duplicateVersionPackages / 25) * 30)),
      layers: ["upgradeImpact", "maintainability"],
      packages: stats.duplicateTop.slice(0, 5).map((x) => x.name),
      evidence: { top: stats.duplicateTop.slice(0, 3) },
    });
  }

  if (stats.maxDepthEstimate >= 6) {
    const priorityScore = clampScore((stats.maxDepthEstimate / 10) * 70);
    push({
      id: "flatten-graph",
      title: "Flatten dependency depth",
      rationale: "Shallower graphs reduce hidden transitive risk and simplify upgrades.",
      impact: impactFromPriority(priorityScore),
      priorityScore,
      estimatedScoreDelta: clampDelta(-clampScore((stats.maxDepthEstimate / 10) * 25)),
      layers: ["maintainability", "upgradeImpact"],
      evidence: { maxDepthEstimate: stats.maxDepthEstimate },
    });
  }

  if (stats.fanInTop.length) {
    const priorityScore = clampScore((stats.fanInMax / 20) * 85);
    push({
      id: "monitor-hotspots",
      title: "Prioritize monitoring for high fan-in transitive packages",
      rationale:
        "Packages with very high fan-in have a larger blast radius for vulnerabilities and breaking changes.",
      impact: impactFromPriority(priorityScore),
      priorityScore,
      estimatedScoreDelta: clampDelta(-clampScore((stats.fanInMax / 20) * 25)),
      layers: ["upgradeImpact", "security"],
      packages: stats.fanInTop.slice(0, 5).map((x) => x.name),
      evidence: { top: stats.fanInTop.slice(0, 3) },
    });
  }

  if (stats.blastRadiusTop.length) {
    const priorityScore = clampScore((stats.blastRadiusMax / 25) * 80);
    push({
      id: "minimize-blast-radius",
      title: "Use smaller upgrade steps for high blast-radius packages",
      rationale:
        "Packages reachable from many direct dependencies can cause widespread breakage when upgraded; incremental upgrades reduce risk.",
      impact: impactFromPriority(priorityScore),
      priorityScore,
      estimatedScoreDelta: clampDelta(-clampScore((stats.blastRadiusMax / 25) * 20)),
      layers: ["upgradeImpact", "maintainability"],
      packages: stats.blastRadiusTop.slice(0, 5).map((x) => x.name),
      evidence: { top: stats.blastRadiusTop.slice(0, 3) },
    });
  }

  if (stats.nodeCount >= 250) {
    const priorityScore = clampScore((stats.nodeCount / 600) * 40);
    push({
      id: "reduce-surface-area",
      title: "Reduce transitive dependency surface area",
      rationale: "Lower transitive volume reduces maintenance cost and hidden risk.",
      impact: impactFromPriority(priorityScore),
      priorityScore,
      estimatedScoreDelta: clampDelta(-clampScore((stats.nodeCount / 200) * 15)),
      layers: ["maintainability", "ecosystem"],
      evidence: { nodeCount: stats.nodeCount },
    });
  }

  return recs;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function finalizeRecommendations(recs: Recommendation[]) {
  const sorted = [...recs].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
  sorted.forEach((r, i) => {
    r.rank = i + 1;
  });
  return sorted.slice(0, 5);
}

