import {
  mapExplainReasonToCatalogPhrase,
  mapFindingToCatalogPhrase,
  mapGraphInsightsToCatalogPhrases,
  mapRecommendationToCatalogPhrase,
  matchSignalFamily,
  type ObservationSignalFamily,
} from "./cardObservationCatalog.js";
import type { RepositoryContextSource } from "./scanNarrativeFacts.js";
import type { ScanResult } from "./types.js";

export type RepositoryContextFact = {
  family: ObservationSignalFamily;
  source: RepositoryContextSource;
  refs?: { packageNames?: string[]; metric?: Record<string, number> };
};

function addFact(
  bucket: RepositoryContextFact[],
  seen: Set<ObservationSignalFamily>,
  fact: RepositoryContextFact,
): void {
  if (seen.has(fact.family)) return;
  seen.add(fact.family);
  bucket.push(fact);
}

/**
 * Tier 3 structured signal refs for the intelligence layer (no catalog phrases).
 */
export function extractRepositoryContextFacts(
  result: ScanResult,
): RepositoryContextFact[] {
  const facts: RepositoryContextFact[] = [];
  const seen = new Set<ObservationSignalFamily>();

  const gi = result.graphInsights;
  if (gi && typeof gi === "object") {
    for (const { family } of mapGraphInsightsToCatalogPhrases(gi)) {
      const metric: Record<string, number> = {};
      if (typeof gi.nodes === "number") metric.nodes = gi.nodes;
      if (typeof gi.maxDepth === "number") metric.maxDepth = gi.maxDepth;
      const vuln = Array.isArray(gi.vulnerable) ? gi.vulnerable : [];
      const hotspots = Array.isArray(gi.hotspots) ? gi.hotspots : [];
      addFact(facts, seen, {
        family,
        source: "graphInsights",
        refs: {
          packageNames: [
            ...vuln.map((v) => v.packageName),
            ...hotspots.map((h) => h.packageName),
          ].slice(0, 12),
          metric: Object.keys(metric).length > 0 ? metric : undefined,
        },
      });
    }
  }

  if (Array.isArray(result.explain?.reasons)) {
    for (const reason of result.explain.reasons) {
      const mapped = mapExplainReasonToCatalogPhrase(reason);
      if (!mapped) {
        const family = matchSignalFamily(
          `${reason.id} ${reason.title} ${reason.layer}`,
        );
        if (family) {
          addFact(facts, seen, { family, source: "explain" });
        }
        continue;
      }
      addFact(facts, seen, { family: mapped.family, source: "explain" });
    }
  }

  if (Array.isArray(result.findings)) {
    for (const finding of result.findings) {
      const mapped = mapFindingToCatalogPhrase(finding);
      if (mapped) {
        addFact(facts, seen, {
          family: mapped.family,
          source: "finding",
          refs: { packageNames: [finding.packageName] },
        });
      }
    }
  }

  if (Array.isArray(result.recommendations)) {
    for (const rec of result.recommendations) {
      const mapped = mapRecommendationToCatalogPhrase(rec);
      if (mapped) {
        addFact(facts, seen, { family: mapped.family, source: "finding" });
      }
    }
  }

  return facts;
}
