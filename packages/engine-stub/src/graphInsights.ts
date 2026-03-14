import type { DependencyGraph } from "./pnpmLock.js";
import type { DependencyGraphInsight, DependencyGraphInsights, RiskSignal } from "@reposentinel/shared";

type Node = { id: string; name: string; version: string };

export function buildGraphInsights(graph: DependencyGraph, signals: RiskSignal[]): DependencyGraphInsights {
  const { depthById, parentById } = computeShortestPaths(graph);

  const nodes = graph.nodes.length;
  const edges = graph.edges.length;
  const maxDepth = Math.max(0, ...Array.from(depthById.values()));

  const deepest = pickDeepest(graph, depthById, parentById);
  const hotspots = pickHotspots(graph, depthById, parentById);
  const vulnerable = pickVulnerable(graph, signals, depthById, parentById);

  return {
    maxDepth,
    nodes,
    edges,
    deepest,
    hotspots,
    vulnerable,
  };
}

function computeShortestPaths(graph: DependencyGraph) {
  const directRoots = Object.entries(graph.directDeps).map(([name, version]) => `${name}@${version}`);

  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const e of graph.edges) {
    const a = adj.get(e.from);
    if (a) a.push(e.to);
    else adj.set(e.from, [e.to]);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    if (!inDegree.has(e.from)) inDegree.set(e.from, inDegree.get(e.from) ?? 0);
  }

  const depthById = new Map<string, number>();
  const parentById = new Map<string, string | null>();

  const roots =
    directRoots.length > 0
      ? directRoots
      : graph.nodes
          .map((n) => n.id)
          .filter((id) => (inDegree.get(id) ?? 0) === 0)
          .sort((a, b) => (adj.get(b)?.length ?? 0) - (adj.get(a)?.length ?? 0));

  const q: string[] = [];
  for (const r of roots) {
    depthById.set(r, 1);
    parentById.set(r, null);
    q.push(r);
  }

  while (q.length) {
    const cur = q.shift()!;
    const curDepth = depthById.get(cur) ?? 1;
    const next = adj.get(cur) ?? [];
    for (const n of next) {
      if (depthById.has(n)) continue;
      depthById.set(n, curDepth + 1);
      parentById.set(n, cur);
      q.push(n);
    }
  }

  // Nodes not reachable from chosen roots are excluded from path-based insights.
  for (const n of graph.nodes) {
    if (!depthById.has(n.id)) {
      depthById.set(n.id, 0);
      parentById.set(n.id, null);
    }
  }

  return { depthById, parentById };
}

function pickDeepest(
  graph: DependencyGraph,
  depthById: Map<string, number>,
  parentById: Map<string, string | null>,
): DependencyGraphInsight[] {
  const ranked = [...graph.nodes]
    .map((n) => ({ n, depth: depthById.get(n.id) ?? 0 }))
    .filter((x) => x.depth > 1)
    .sort((a, b) => b.depth - a.depth)
    .slice(0, 5);

  return ranked.map(({ n, depth }) => ({
    kind: "deep",
    packageName: n.name,
    version: n.version,
    direct: false,
    depth,
    via: pathFor(n.id, parentById, graph),
  }));
}

function pickHotspots(
  graph: DependencyGraph,
  depthById: Map<string, number>,
  parentById: Map<string, string | null>,
): DependencyGraphInsight[] {
  const direct = new Set(Object.keys(graph.directDeps));

  return graph.fanInTop.slice(0, 5).map((x) => {
    const id = `${x.name}@${x.version}`;
    const depth = depthById.get(id) ?? 0;
    return {
      kind: "hotspot",
      packageName: x.name,
      version: x.version,
      direct: direct.has(x.name),
      depth: depth || (direct.has(x.name) ? 1 : 2),
      via: pathFor(id, parentById, graph),
      evidence: { fanIn: x.fanIn },
    };
  });
}

function pickVulnerable(
  graph: DependencyGraph,
  signals: RiskSignal[],
  depthById: Map<string, number>,
  parentById: Map<string, string | null>,
): DependencyGraphInsight[] {
  const direct = new Set(Object.keys(graph.directDeps));

  const total = signals.find((s) => s.id === "vuln.osv_total_vulns");
  const top = (total?.evidence as any)?.top;
  const items = Array.isArray(top) ? top : [];

  return items.slice(0, 8).map((v: any) => {
    const name = String(v?.name ?? "");
    const version = String(v?.version ?? "");
    const id = name && version ? `${name}@${version}` : "";
    const depth = id ? depthById.get(id) ?? 0 : 0;
    return {
      kind: "vulnerable",
      packageName: name || "unknown",
      version: version || undefined,
      direct: direct.has(name),
      depth: depth || (direct.has(name) ? 1 : 2),
      via: id ? pathFor(id, parentById, graph) : undefined,
      evidence: {
        count: Number(v?.count ?? 0),
        worstScore: v?.worstScore ?? null,
        topIds: v?.topIds ?? [],
      },
    };
  });
}

function pathFor(id: string, parentById: Map<string, string | null>, graph: DependencyGraph) {
  if (!id) return undefined;
  const seen = new Set<string>();
  const chain: string[] = [];
  let cur: string | null | undefined = id;
  while (cur && !seen.has(cur) && chain.length < 12) {
    seen.add(cur);
    chain.push(cur);
    cur = parentById.get(cur) ?? null;
  }

  const nodesById = new Map<string, Node>(graph.nodes.map((n) => [n.id, n]));
  const pretty = chain
    .reverse()
    .map((cid) => {
      const n = nodesById.get(cid);
      return n ? `${n.name}@${n.version}` : cid;
    })
    .slice(0, 12);

  return pretty.length >= 2 ? pretty : undefined;
}

