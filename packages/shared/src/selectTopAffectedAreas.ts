import type { ScanResult } from "./types.js";

export type TopAreasOptions = {
  max?: number;
  maxLabelLen?: number;
};

/**
 * Select up to `max` (default 3) compact human-readable area labels from a
 * ScanResult, ordered by signal strength. Returns [] when nothing meaningful
 * can be surfaced — callers should omit the UI block entirely in that case.
 *
 * Priority order (first-match-wins per slot, deduped):
 *   1. explain.reasons sorted by |scoreImpact| (most impactful first)
 *   2. insights[].message (dedupe by first sentence)
 *   3. Layer names from layerScores (only when slots 1+2 yielded nothing)
 */
export function selectTopAffectedAreas(
  result: ScanResult | null | undefined,
  opts: TopAreasOptions = {},
): string[] {
  if (!result) return [];

  const max = opts.max ?? 3;
  const maxLabelLen = opts.maxLabelLen ?? 38;

  function trimLabel(raw: string): string {
    const clean = raw.replace(/^(Finding:\s*|Area:\s*)/i, "").trim();
    return clean.length > maxLabelLen
      ? clean.slice(0, maxLabelLen - 1) + "…"
      : clean;
  }

  const seen = new Set<string>();
  const areas: string[] = [];

  function add(label: string): boolean {
    if (areas.length >= max) return false;
    const t = trimLabel(label);
    const key = t.toLowerCase();
    if (!t || seen.has(key)) return false;
    seen.add(key);
    areas.push(t);
    return areas.length < max;
  }

  // Priority 1: explain.reasons sorted by absolute scoreImpact
  if (Array.isArray(result.explain?.reasons)) {
    const sorted = [...result.explain.reasons]
      .filter((r) => r.title)
      .sort(
        (a, b) => Math.abs(b.scoreImpact ?? 0) - Math.abs(a.scoreImpact ?? 0),
      );
    for (const r of sorted) {
      if (!add(r.title)) break;
    }
  }

  if (areas.length >= max) return areas;

  // Priority 2: PR insights — first sentence of message
  if (Array.isArray(result.insights)) {
    for (const ins of result.insights) {
      if (!ins.message) continue;
      const firstSentence = ins.message.split(".")[0] ?? ins.message;
      if (!add(firstSentence)) break;
    }
  }

  if (areas.length >= max) return areas;

  // Priority 3: layer names only when nothing else surfaced
  if (areas.length === 0) {
    const LAYER_LABELS: Record<string, string> = {
      security: "Security",
      maintainability: "Maintainability",
      ecosystem: "Ecosystem",
      upgradeImpact: "Upgrade impact",
    };
    const layerScores = result.layerScores;
    if (!layerScores || typeof layerScores !== "object") return areas;
    const sorted = Object.entries(layerScores as Record<string, number>)
      .filter(([, v]) => typeof v === "number")
      // highest score = most impactful layer (inverted: higher score = worse)
      .sort(([, a], [, b]) => (b as number) - (a as number));
    for (const [layer] of sorted) {
      if (!add(LAYER_LABELS[layer] ?? layer)) break;
    }
  }

  return areas;
}
