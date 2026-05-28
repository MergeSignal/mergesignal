import { humanizeEngineSurfaceText } from "./actionsStepSummary.js";
import type {
  DependencyGraphInsights,
  ExplainReason,
  Finding,
  Recommendation,
  ScoreLayer,
} from "./types.js";

/**
 * CATALOG_EXPANSION_CHECKLIST (G1):
 * - Names a specific structural/topological concept (chains, paths, versions,
 *   blast radius, hotspots, surface area, transitive volume)?
 * - Would NOT apply to an arbitrary PR without graph/dependency context?
 * - ≤48 chars, non-sentence fragment, no imperatives, no digits?
 * - Maps from a distinct signal family (not a catch-all)?
 * If any answer is no → do not add.
 */

export const CARD_OBSERVATION_MAX_LENGTH = 48;

export const CARD_OBSERVATION_CATALOG = [
  "Large upgrade blast radius",
  "High transitive dependency volume",
  "Broad package surface area",
  "Duplicate dependency versions detected",
  "Vulnerable transitive packages detected",
  "Stale ecosystem dependencies detected",
  "Transitive dependency hotspots detected",
  "Deep indirect dependency chains",
  "Overlapping dependency paths detected",
] as const;

export type CatalogPhrase = (typeof CARD_OBSERVATION_CATALOG)[number];

/** Signal family keys — one catalog phrase per family on a card. */
export type ObservationSignalFamily =
  | "blast_radius"
  | "transitive_volume"
  | "package_surface"
  | "duplicate_versions"
  | "vulnerable_transitive"
  | "stale_ecosystem"
  | "transitive_hotspots"
  | "indirect_chains"
  | "overlapping_paths";

export const CARD_OBSERVATION_SIGNAL_FAMILIES: Record<
  ObservationSignalFamily,
  CatalogPhrase
> = {
  blast_radius: "Large upgrade blast radius",
  transitive_volume: "High transitive dependency volume",
  package_surface: "Broad package surface area",
  duplicate_versions: "Duplicate dependency versions detected",
  vulnerable_transitive: "Vulnerable transitive packages detected",
  stale_ecosystem: "Stale ecosystem dependencies detected",
  transitive_hotspots: "Transitive dependency hotspots detected",
  indirect_chains: "Deep indirect dependency chains",
  overlapping_paths: "Overlapping dependency paths detected",
};

const IMPERATIVE_VERBS =
  /^(reduce|upgrade|review|consider|mitigate|minimize|minimise|avoid|improve|optimize|optimise|ensure|verify|audit|check|address|fix|resolve)\b/i;

const GENERIC_OBSERVATION_PATTERNS: readonly RegExp[] = [
  /\bruntime issue/i,
  /\bdependency concern/i,
  /\becosystem risk/i,
  /\bmerge risk/i,
  /\boperational review recommended/i,
  /\boperational change detected/i,
  /\bruntime-relevant dependency change/i,
  /\blimited operational change/i,
  /\bhigh-confidence merge risk/i,
  /\bdependency change\b/i,
  /\bpotential runtime impact/i,
  /\bno merge blocker/i,
];

const TELEMETRY_PATTERNS: readonly RegExp[] = [
  /\d/,
  /\bgraph\./i,
  /\bscoreimpact\b/i,
  /\bfan[\s_-]?in\b/i,
  /\bmax depth\b/i,
  /\bnode count\b/i,
  /\bthreshold\b/i,
  /\bmaint-stale\b/i,
  /\becosystem\.package\s*surface\b/i,
];

const SIGNAL_FAMILY_PATTERNS: ReadonlyArray<{
  family: ObservationSignalFamily;
  patterns: readonly RegExp[];
}> = [
  {
    family: "duplicate_versions",
    patterns: [
      /\bduplicat/i,
      /\boverlapping dependency paths/i,
      /\bsemver overlap/i,
      /\bmultiple majors/i,
      /\bgraph\.duplicates?\b/i,
    ],
  },
  {
    family: "vulnerable_transitive",
    patterns: [
      /\bvulnerab/i,
      /\bosv\b/i,
      /\badvisory\b/i,
      /\bknown vulnerable packages/i,
      /\bgraph\.vulnerable\b/i,
      /\bsecurity_vulnerability\b/i,
    ],
  },
  {
    family: "stale_ecosystem",
    patterns: [
      /\bstale\b/i,
      /\boutdated\b/i,
      /\bdeprecated release/i,
      /\bmaint-stale\b/i,
      /\becosystem_registry\b/i,
      /\bstale releases\b/i,
    ],
  },
  {
    family: "transitive_hotspots",
    patterns: [
      /\bhotspot/i,
      /\bgraph\.hotspot\b/i,
      /\bmany import paths converge/i,
      /\bshared packages see many inbound/i,
    ],
  },
  {
    family: "indirect_chains",
    patterns: [
      /\bindirect dependency depth\b/i,
      /\bdependency chain depth\b/i,
      /\bgraph\.depth\b/i,
      /\bgraph\.hidden\b/i,
      /\bhidden transitive paths\b/i,
      /\bdeepest resolved chain\b/i,
      /\blong indirect/i,
    ],
  },
  {
    family: "transitive_volume",
    patterns: [
      /\btransitive dependency volume\b/i,
      /\bgraph\.transitive\b/i,
      /\btransitive volume\b/i,
      /\btransitive churn\b/i,
      /\bindirect dependencies\b/i,
    ],
  },
  {
    family: "package_surface",
    patterns: [
      /\bpackage surface\b/i,
      /\bpackage footprint\b/i,
      /\bbroad declared package\b/i,
      /\becosystem\.package\s*surface\b/i,
      /\bdeclared package footprint\b/i,
      /\btransitive surface area\b/i,
      /\bdependency surface area\b/i,
      /\btransitive dependency surface\b/i,
    ],
  },
  {
    family: "blast_radius",
    patterns: [
      /\bblast radius\b/i,
      /\bupgrade impact\b/i,
      /\bbreaking change\b/i,
      /\bmajor version\b/i,
      /\bupgradeImpact\b/i,
      /\blarge upgrade\b/i,
    ],
  },
  {
    family: "overlapping_paths",
    patterns: [
      /\boverlapping dependency paths to the same packages\b/i,
      /\bmultiple paths to the same package\b/i,
    ],
  },
];

export function isCatalogPhrase(text: string): text is CatalogPhrase {
  return (CARD_OBSERVATION_CATALOG as readonly string[]).includes(text);
}

export function containsTelemetryOrDigits(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return TELEMETRY_PATTERNS.some((re) => re.test(t));
}

export function containsImperativeOrActionLanguage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return IMPERATIVE_VERBS.test(t);
}

export function isGenericObservation(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return GENERIC_OBSERVATION_PATTERNS.some((re) => re.test(t));
}

export function isSentenceLike(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\.\s+\S/.test(t)) return true;
  if (/\s—\s/.test(t)) return true;
  if (/;\s/.test(t)) return true;
  if (/\bbecause\b/i.test(t)) return true;
  if (/\bwhich means\b/i.test(t)) return true;
  if (/\bso that\b/i.test(t)) return true;
  return false;
}

export function enforceMaxLength(
  text: string,
  max = CARD_OBSERVATION_MAX_LENGTH,
): boolean {
  return text.trim().length <= max;
}

export function phraseForFamily(
  family: ObservationSignalFamily,
): CatalogPhrase {
  return CARD_OBSERVATION_SIGNAL_FAMILIES[family];
}

function normalizeMatchText(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => humanizeEngineSurfaceText(p))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function matchSignalFamily(
  text: string,
): ObservationSignalFamily | null {
  const normalized = normalizeMatchText(text);
  if (!normalized) return null;
  for (const { family, patterns } of SIGNAL_FAMILY_PATTERNS) {
    if (patterns.some((re) => re.test(normalized))) return family;
  }
  return null;
}

export function mapTextToCatalogPhrase(
  text: string | null | undefined,
): { phrase: CatalogPhrase; family: ObservationSignalFamily } | null {
  if (!text?.trim()) return null;
  const family = matchSignalFamily(text);
  if (!family) return null;
  const phrase = phraseForFamily(family);
  return { phrase, family };
}

export function mapRecommendationToCatalogPhrase(
  rec: Recommendation,
): { phrase: CatalogPhrase; family: ObservationSignalFamily } | null {
  const combined = `${rec.title} ${rec.rationale}`;
  return mapTextToCatalogPhrase(combined);
}

export function mapExplainReasonToCatalogPhrase(
  reason: ExplainReason,
): { phrase: CatalogPhrase; family: ObservationSignalFamily } | null {
  const combined = `${reason.id} ${reason.title} ${reason.layer}`;
  return mapTextToCatalogPhrase(combined);
}

export function mapFindingToCatalogPhrase(
  finding: Finding,
): { phrase: CatalogPhrase; family: ObservationSignalFamily } | null {
  const categoryMap: Partial<
    Record<NonNullable<Finding["category"]>, ObservationSignalFamily>
  > = {
    security_vulnerability: "vulnerable_transitive",
    ecosystem_registry: "stale_ecosystem",
    breaking_change: "blast_radius",
    major_version: "blast_radius",
    deprecation: "stale_ecosystem",
  };

  const combined = `${finding.title} ${finding.description} ${finding.category ?? ""}`;
  const fromText = mapTextToCatalogPhrase(combined);
  if (fromText) return fromText;

  const fromCategory = finding.category
    ? categoryMap[finding.category]
    : undefined;
  if (fromCategory) {
    return { phrase: phraseForFamily(fromCategory), family: fromCategory };
  }

  return null;
}

export function mapContributionToCatalogPhrase(
  id: string,
): { phrase: CatalogPhrase; family: ObservationSignalFamily } | null {
  return mapTextToCatalogPhrase(id);
}

export function mapGraphInsightsToCatalogPhrases(
  gi: DependencyGraphInsights | null | undefined,
): Array<{ phrase: CatalogPhrase; family: ObservationSignalFamily }> {
  if (!gi || typeof gi !== "object") return [];

  const out: Array<{
    phrase: CatalogPhrase;
    family: ObservationSignalFamily;
  }> = [];
  const seen = new Set<ObservationSignalFamily>();

  function add(family: ObservationSignalFamily): void {
    if (seen.has(family)) return;
    seen.add(family);
    out.push({ phrase: phraseForFamily(family), family });
  }

  const vulnCount = Array.isArray(gi.vulnerable) ? gi.vulnerable.length : 0;
  const hotspotCount = Array.isArray(gi.hotspots) ? gi.hotspots.length : 0;
  const depth =
    typeof gi.maxDepth === "number" && Number.isFinite(gi.maxDepth)
      ? gi.maxDepth
      : null;
  const nodes =
    typeof gi.nodes === "number" && Number.isFinite(gi.nodes) ? gi.nodes : 0;

  if (vulnCount > 0) add("vulnerable_transitive");
  if (hotspotCount >= 4) add("transitive_hotspots");
  if (depth !== null && depth >= 8) add("indirect_chains");
  else if (depth !== null && depth >= 5) add("indirect_chains");
  if (nodes >= 1200) add("transitive_volume");
  else if (nodes >= 600 && out.length < 2) add("transitive_volume");

  return out;
}

export function mapLayerToCatalogPhrase(
  layer: ScoreLayer,
): { phrase: CatalogPhrase; family: ObservationSignalFamily } | null {
  const layerMap: Partial<Record<ScoreLayer, ObservationSignalFamily>> = {
    upgradeImpact: "blast_radius",
    ecosystem: "package_surface",
    security: "vulnerable_transitive",
    maintainability: "stale_ecosystem",
  };
  const family = layerMap[layer];
  if (!family) return null;
  return { phrase: phraseForFamily(family), family };
}

/** Validate catalog integrity at module load (tests also cover). */
export function validateCatalogIntegrity(): void {
  for (const phrase of CARD_OBSERVATION_CATALOG) {
    if (!enforceMaxLength(phrase)) {
      throw new Error(`Catalog phrase exceeds max length: ${phrase}`);
    }
    if (containsTelemetryOrDigits(phrase)) {
      throw new Error(`Catalog phrase contains telemetry/digits: ${phrase}`);
    }
    if (containsImperativeOrActionLanguage(phrase)) {
      throw new Error(`Catalog phrase contains imperative: ${phrase}`);
    }
    if (isSentenceLike(phrase)) {
      throw new Error(`Catalog phrase is sentence-like: ${phrase}`);
    }
  }
}

validateCatalogIntegrity();
