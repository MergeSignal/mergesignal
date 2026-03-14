import type {
  RiskSignal,
  ScanLockfileInput,
  ScanResult,
  ScoreLayer,
  UpgradeSimulationDelta,
  UpgradeSimulationImpact,
  UpgradeSimulationRequest,
  UpgradeSimulationResult,
} from "@reposentinel/shared";
import { graphFromPnpmLockfile, type DependencyGraph } from "./pnpmLock";
import { analyze } from "./analyze";

export async function simulateUpgrade(
  req: UpgradeSimulationRequest,
): Promise<UpgradeSimulationResult> {
  const currentGraph = graphFromLockfile(req.currentLockfile);
  const before = await analyze({
    repoId: req.repoId,
    dependencyGraph: currentGraph,
    lockfile: req.currentLockfile,
  });

  const after =
    req.proposedLockfile && sameManager(req.currentLockfile, req.proposedLockfile)
      ? await analyze({
          repoId: req.repoId,
          dependencyGraph: graphFromLockfile(req.proposedLockfile),
          lockfile: req.proposedLockfile,
        })
      : undefined;

  const impact = req.target ? computeImpact(currentGraph, req.target.packageName) : undefined;
  const delta = after ? computeDelta(before, after) : undefined;

  return {
    before,
    after,
    delta,
    impact,
    generatedAt: new Date().toISOString(),
  };
}

function sameManager(a: ScanLockfileInput, b: ScanLockfileInput) {
  return a.manager === b.manager;
}

function graphFromLockfile(lockfile: ScanLockfileInput): DependencyGraph {
  if (lockfile.manager !== "pnpm") {
    throw new Error(`Unsupported lockfile manager: ${lockfile.manager}`);
  }
  return graphFromPnpmLockfile(lockfile.content);
}

function computeDelta(before: ScanResult, after: ScanResult): UpgradeSimulationDelta {
  const layerScoreDeltas: Partial<Record<ScoreLayer, number>> = {};
  for (const layer of Object.keys(before.layerScores) as ScoreLayer[]) {
    layerScoreDeltas[layer] = (after.layerScores[layer] ?? 0) - (before.layerScores[layer] ?? 0);
  }

  const beforeSignals = indexSignals(before.signals);
  const afterSignals = indexSignals(after.signals);
  const allIds = new Set([...Object.keys(beforeSignals), ...Object.keys(afterSignals)]);

  const topSignalDeltas = Array.from(allIds)
    .map((id) => {
      const b = beforeSignals[id];
      const a = afterSignals[id];
      const layer = (a?.layer ?? b?.layer ?? "maintainability") as ScoreLayer;
      return {
        id,
        layer,
        before: b?.value,
        after: a?.value,
        scoreImpactBefore: b?.scoreImpact,
        scoreImpactAfter: a?.scoreImpact,
        delta: (a?.scoreImpact ?? 0) - (b?.scoreImpact ?? 0),
      };
    })
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, 8)
    .map(({ delta: _delta, ...rest }) => rest);

  return {
    totalScoreDelta: after.totalScore - before.totalScore,
    layerScoreDeltas,
    topSignalDeltas,
  };
}

function indexSignals(signals: RiskSignal[] | undefined): Record<string, RiskSignal> {
  if (!signals) return {};
  const out: Record<string, RiskSignal> = {};
  for (const s of signals) out[s.id] = s;
  return out;
}

function computeImpact(graph: DependencyGraph, packageName: string): UpgradeSimulationImpact {
  const matching = graph.nodes.filter((n) => n.name === packageName);
  const observedVersions = Array.from(new Set(matching.map((n) => n.version))).sort();

  const fanInById = new Map<string, number>();
  for (const e of graph.edges) fanInById.set(e.to, (fanInById.get(e.to) ?? 0) + 1);

  const rootReachCount = computeRootReachCount(graph);

  const best = matching
    .map((n) => ({
      id: n.id,
      version: n.version,
      fanIn: fanInById.get(n.id) ?? 0,
      roots: rootReachCount.get(n.id) ?? 0,
    }))
    .sort((a, b) => b.roots - a.roots || b.fanIn - a.fanIn)[0];

  return {
    packageName,
    observedVersions,
    fanIn: best?.fanIn ?? 0,
    rootBlastRadius: best?.roots ?? 0,
  };
}

function computeRootReachCount(graph: DependencyGraph): Map<string, number> {
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    const a = adj.get(e.from);
    if (a) a.push(e.to);
    else adj.set(e.from, [e.to]);
  }

  const roots = Object.entries(graph.directDeps).map(([n, v]) => `${n}@${v}`);

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
  return reachCount;
}

