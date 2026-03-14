import { parse as parseYaml } from "yaml";

export type DepNodeId = string;

export type DependencyGraph = {
  nodes: Array<{ id: DepNodeId; name: string; version: string }>;
  edges: Array<{ from: DepNodeId; to: DepNodeId }>;
  directDeps: Record<string, string>;
  versionsByName: Record<string, string[]>;
  maxDepth: number;
  fanInTop: Array<{ id: DepNodeId; name: string; version: string; fanIn: number }>;
  blastRadiusTop: Array<{ id: DepNodeId; name: string; version: string; roots: number }>;
};

type PnpmLock = {
  lockfileVersion?: string | number;
  importers?: Record<
    string,
    {
      dependencies?: Record<string, { version: string }>;
      devDependencies?: Record<string, { version: string }>;
      optionalDependencies?: Record<string, { version: string }>;
    }
  >;
  packages?: Record<
    string,
    {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    }
  >;
  snapshots?: Record<
    string,
    {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    }
  >;
};

export function graphFromPnpmLockfile(lockfileYaml: string): DependencyGraph {
  const doc = parseYaml(lockfileYaml) as PnpmLock;
  const packages = doc?.packages ?? {};
  const snapshots = doc?.snapshots ?? {};
  const depIndex = Object.keys(snapshots).length ? snapshots : packages;

  const nodes = new Map<DepNodeId, { id: DepNodeId; name: string; version: string }>();
  const edges: Array<{ from: DepNodeId; to: DepNodeId }> = [];

  const versionsByName = new Map<string, Set<string>>();

  const ensureNode = (name: string, version: string) => {
    const id = `${name}@${version}`;
    if (!nodes.has(id)) nodes.set(id, { id, name, version });
    let set = versionsByName.get(name);
    if (!set) {
      set = new Set<string>();
      versionsByName.set(name, set);
    }
    set.add(version);
    return id;
  };

  for (const rawKey of Object.keys(packages)) {
    const baseKey = rawKey.split("(")[0];
    const parsed = parseNameVersion(baseKey);
    if (!parsed) continue;
    ensureNode(parsed.name, parsed.version);
  }

  // pnpm lockfile v9 stores dependency edges under `snapshots`.
  for (const rawKey of Object.keys(depIndex)) {
    const baseKey = rawKey.split("(")[0];
    const fromParsed = parseNameVersion(baseKey);
    if (!fromParsed) continue;
    const fromId = ensureNode(fromParsed.name, fromParsed.version);

    const entry = depIndex[rawKey] ?? {};
    const deps = {
      ...(entry.dependencies ?? {}),
      ...(entry.optionalDependencies ?? {}),
    };

    for (const depName of Object.keys(deps)) {
      const ref = deps[depName];
      const refBase = String(ref).split("(")[0];
      const depVersion = parseVersionRef(refBase);
      if (!depVersion) continue;
      const toId = ensureNode(depName, depVersion);
      edges.push({ from: fromId, to: toId });
    }
  }

  const directDeps = extractImporterDirectDeps(doc);

  for (const [name, version] of Object.entries(directDeps)) {
    ensureNode(name, version);
  }

  const maxDepth = estimateMaxDepth(edges, Array.from(Object.entries(directDeps)).map(([n, v]) => `${n}@${v}`));
  const fanInTop = computeTopFanIn(nodes, edges, 10);
  const blastRadiusTop = computeTopBlastRadius(nodes, edges, Object.entries(directDeps).map(([n, v]) => `${n}@${v}`), 10);

  return {
    nodes: Array.from(nodes.values()),
    edges,
    directDeps,
    versionsByName: Object.fromEntries(
      Array.from(versionsByName.entries()).map(([k, v]) => [k, Array.from(v.values()).sort()]),
    ),
    maxDepth,
    fanInTop,
    blastRadiusTop,
  };
}

function extractImporterDirectDeps(doc: PnpmLock): Record<string, string> {
  const importers = doc.importers ?? {};
  const root = importers["."] ?? Object.values(importers)[0];
  if (!root) return {};

  const out: Record<string, string> = {};
  const all = {
    ...(root.dependencies ?? {}),
    ...(root.devDependencies ?? {}),
    ...(root.optionalDependencies ?? {}),
  };

  for (const [name, meta] of Object.entries(all)) {
    const v = meta?.version;
    if (!v) continue;
    const base = String(v).split("(")[0];
    const ver = parseVersionRef(base);
    if (!ver) continue;
    out[name] = ver;
  }
  return out;
}

function parseVersionRef(ref: string): string | null {
  if (!ref) return null;
  if (ref.startsWith("link:") || ref.startsWith("workspace:") || ref.startsWith("file:")) return null;
  return ref;
}

function parseNameVersion(input: string): { name: string; version: string } | null {
  const s = input.trim();
  const at = s.lastIndexOf("@");
  if (at <= 0) return null;
  const name = s.slice(0, at);
  const version = s.slice(at + 1);
  if (!name || !version) return null;
  return { name, version };
}

function estimateMaxDepth(edges: Array<{ from: string; to: string }>, roots: string[]): number {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const a = adj.get(e.from);
    if (a) a.push(e.to);
    else adj.set(e.from, [e.to]);
  }

  const visited = new Set<string>();
  let max = 0;

  const stack: Array<{ id: string; depth: number }> = roots.map((id) => ({ id, depth: 1 }));
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur.depth > max) max = cur.depth;
    if (cur.depth > 100) continue;
    const key = `${cur.id}@${cur.depth}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const next = adj.get(cur.id);
    if (!next) continue;
    for (const n of next) stack.push({ id: n, depth: cur.depth + 1 });
  }

  return max;
}

function computeTopFanIn(
  nodes: Map<string, { id: string; name: string; version: string }>,
  edges: Array<{ from: string; to: string }>,
  limit: number,
) {
  const fanIn = new Map<string, number>();
  for (const e of edges) fanIn.set(e.to, (fanIn.get(e.to) ?? 0) + 1);

  const ranked = Array.from(fanIn.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => {
      const n = nodes.get(id);
      return n ? { id, name: n.name, version: n.version, fanIn: count } : null;
    })
    .filter(Boolean) as Array<{ id: string; name: string; version: string; fanIn: number }>;

  return ranked;
}

function computeTopBlastRadius(
  nodes: Map<string, { id: string; name: string; version: string }>,
  edges: Array<{ from: string; to: string }>,
  roots: string[],
  limit: number,
) {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const a = adj.get(e.from);
    if (a) a.push(e.to);
    else adj.set(e.from, [e.to]);
  }

  const reachCount = new Map<string, number>();

  for (const root of roots) {
    const seen = new Set<string>();
    const stack = [root];
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      reachCount.set(cur, (reachCount.get(cur) ?? 0) + 1);
      const next = adj.get(cur);
      if (!next) continue;
      for (const n of next) stack.push(n);
    }
  }

  const ranked = Array.from(reachCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, rootsCount]) => {
      const n = nodes.get(id);
      return n ? { id, name: n.name, version: n.version, roots: rootsCount } : null;
    })
    .filter(Boolean) as Array<{ id: string; name: string; version: string; roots: number }>;

  return ranked;
}

