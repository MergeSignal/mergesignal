import { sortRecommendationsForDisplay } from "./actionsStepSummary.js";
import {
  type CatalogPhrase,
  mapContributionToCatalogPhrase,
  mapExplainReasonToCatalogPhrase,
  mapFindingToCatalogPhrase,
  mapGraphInsightsToCatalogPhrases,
  mapRecommendationToCatalogPhrase,
  mapTextToCatalogPhrase,
  type ObservationSignalFamily,
  phraseForFamily,
} from "./cardObservationCatalog.js";
import { formatCardAreaLabels } from "./formatCardAreaLabels.js";
import { selectTopAffectedAreas } from "./selectTopAffectedAreas.js";
import type { MergePosture } from "./riskVocabulary.js";
import type { ScanResult } from "./types.js";

export type CardOperationalObservations = {
  operationalObservations: CatalogPhrase[];
  supportingLine: string | null;
};

export type DeriveCardOperationalObservationsOptions = {
  mergePosture: MergePosture | null;
  /** Primary path: full ScanResult JSON present. Never emit posture fallbacks. */
  hasFullResult?: boolean;
  max?: number;
};

type RankedCandidate = {
  phrase: CatalogPhrase;
  family: ObservationSignalFamily;
  weight: number;
  rank: number;
};

const SOURCE_WEIGHT = {
  recommendation: 100,
  explain: 80,
  finding: 60,
  graph: 50,
  contribution: 45,
  summary: 20,
  area: 15,
} as const;

let rankCounter = 0;
function nextRank(): number {
  rankCounter += 1;
  return rankCounter;
}

function addCandidate(
  bucket: RankedCandidate[],
  candidate: {
    phrase: CatalogPhrase;
    family: ObservationSignalFamily;
    weight: number;
  },
): void {
  bucket.push({ ...candidate, rank: nextRank() });
}

function collectCandidates(result: ScanResult): RankedCandidate[] {
  const candidates: RankedCandidate[] = [];
  rankCounter = 0;

  const recs = sortRecommendationsForDisplay(
    Array.isArray(result.recommendations) ? result.recommendations : [],
  );
  for (const rec of recs) {
    const mapped = mapRecommendationToCatalogPhrase(rec);
    if (mapped) {
      addCandidate(candidates, {
        ...mapped,
        weight: SOURCE_WEIGHT.recommendation,
      });
    }
  }

  if (Array.isArray(result.explain?.reasons)) {
    const sorted = [...result.explain.reasons]
      .filter((r) => r.title)
      .sort(
        (a, b) => Math.abs(b.scoreImpact ?? 0) - Math.abs(a.scoreImpact ?? 0),
      );
    for (const reason of sorted) {
      const mapped = mapExplainReasonToCatalogPhrase(reason);
      if (mapped) {
        addCandidate(candidates, {
          ...mapped,
          weight: SOURCE_WEIGHT.explain,
        });
      }
    }
  }

  if (Array.isArray(result.findings)) {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    const sortedFindings = [...result.findings].sort(
      (a, b) =>
        (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0),
    );
    for (const finding of sortedFindings) {
      const mapped = mapFindingToCatalogPhrase(finding);
      if (mapped) {
        addCandidate(candidates, {
          ...mapped,
          weight: SOURCE_WEIGHT.finding,
        });
      }
    }
  }

  for (const mapped of mapGraphInsightsToCatalogPhrases(result.graphInsights)) {
    addCandidate(candidates, {
      ...mapped,
      weight: SOURCE_WEIGHT.graph,
    });
  }

  if (Array.isArray(result.contributions)) {
    for (const c of result.contributions) {
      const mapped = mapContributionToCatalogPhrase(c.id);
      if (mapped) {
        addCandidate(candidates, {
          ...mapped,
          weight: SOURCE_WEIGHT.contribution,
        });
      }
    }
  }

  const reasoning = result.decision?.reasoning;
  if (Array.isArray(reasoning)) {
    for (const line of reasoning) {
      const mapped = mapTextToCatalogPhrase(line);
      if (mapped) {
        addCandidate(candidates, {
          ...mapped,
          weight: SOURCE_WEIGHT.summary,
        });
      }
    }
  }

  if (Array.isArray(result.insights)) {
    for (const ins of result.insights) {
      const mapped = mapTextToCatalogPhrase(ins.message);
      if (mapped) {
        addCandidate(candidates, {
          ...mapped,
          weight: SOURCE_WEIGHT.summary,
        });
      }
    }
  }

  return candidates;
}

function selectObservations(
  candidates: RankedCandidate[],
  max: number,
): CatalogPhrase[] {
  const byFamily = new Map<ObservationSignalFamily, RankedCandidate>();

  for (const c of candidates) {
    const existing = byFamily.get(c.family);
    if (!existing || c.weight > existing.weight) {
      byFamily.set(c.family, c);
    } else if (c.weight === existing.weight && c.rank < existing.rank) {
      byFamily.set(c.family, c);
    }
  }

  const distinct = [...byFamily.values()].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.rank - b.rank;
  });

  if (distinct.length === 0) return [];

  const topWeight = distinct[0]!.weight;
  const strongFamilies = distinct.filter(
    (c) => c.weight >= topWeight - 15 || c.weight >= SOURCE_WEIGHT.finding,
  );

  let take = distinct;
  if (strongFamilies.length <= 2 && distinct.length > 2) {
    take = distinct.slice(0, 2);
  } else if (distinct.length > max) {
    take = distinct.slice(0, max);
  }

  return take.map((c) => c.phrase);
}

function deriveSupportingLine(
  result: ScanResult,
  observations: CatalogPhrase[],
  candidates: RankedCandidate[],
): string | null {
  if (observations.length !== 1) return null;

  const usedPhrase = observations[0]!;
  const usedFamily = candidates.find((c) => c.phrase === usedPhrase)?.family;

  const secondCatalog = candidates.find(
    (c) => c.phrase !== usedPhrase && c.family !== usedFamily,
  );
  if (secondCatalog) return secondCatalog.phrase;

  const areas = formatCardAreaLabels(
    selectTopAffectedAreas(result, { max: 2 }),
  );
  const area = areas[0];
  if (area && area.length <= 48 && !/\d/.test(area)) {
    return area;
  }

  return null;
}

function denormalizedFallback(
  mergePosture: MergePosture | null,
): CardOperationalObservations {
  if (mergePosture === "safe") {
    return { operationalObservations: [], supportingLine: null };
  }
  if (mergePosture === "needs_review") {
    return { operationalObservations: [], supportingLine: null };
  }
  return { operationalObservations: [], supportingLine: null };
}

/**
 * Derive 0–3 catalog-mapped operational observations for PR dashboard cards.
 * Primary path: silence when no mappable signals (G2).
 */
export function deriveCardOperationalObservations(
  result: ScanResult | null | undefined,
  options: DeriveCardOperationalObservationsOptions,
): CardOperationalObservations {
  const max = options.max ?? 3;
  const hasFullResult = options.hasFullResult !== false;

  if (!result) {
    if (hasFullResult) {
      return { operationalObservations: [], supportingLine: null };
    }
    return denormalizedFallback(options.mergePosture);
  }

  const candidates = collectCandidates(result);
  const operationalObservations = selectObservations(candidates, max);

  if (operationalObservations.length === 0) {
    if (hasFullResult) {
      return { operationalObservations: [], supportingLine: null };
    }
    return denormalizedFallback(options.mergePosture);
  }

  const supportingLine = deriveSupportingLine(
    result,
    operationalObservations,
    candidates,
  );

  return { operationalObservations, supportingLine };
}
