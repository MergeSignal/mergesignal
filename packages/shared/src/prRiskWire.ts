import type {
  LayerScores,
  PrRiskWire,
  RepositoryHealthWire,
  ScanResult,
  ScoreLayer,
} from "./types.js";

export type { PrRiskWire, RepositoryHealthWire };

export type PrRiskScoreContext = {
  /** Denormalized pr_risk_score column when result JSON is absent. */
  prRiskScore?: number | null;
  /**
   * Historical scans.total_score column — fallback only when prRisk wire and
   * pr_risk_score are both absent (pre-migration rows).
   */
  legacyTotalScore?: number | null;
};

export type RepositoryHealthScoreContext = {
  /** Denormalized repository_health_score column when result JSON is absent. */
  repositoryHealthScore?: number | null;
  /** When true, legacy totalScore must not be used as repository health. */
  isPrScan?: boolean;
  /**
   * Historical scans.total_score column — fallback only for non-PR scans when
   * repositoryHealth wire and repository_health_score are both absent.
   */
  legacyTotalScore?: number | null;
};

export type ScanScoreRow = {
  pr_risk_score?: number | null;
  repository_health_score?: number | null;
  /** Historical scans.total_score column — never authoritative for new rows. */
  total_score?: number | null;
  github_pr_number?: number | null;
  result?: ScanResult | Record<string, unknown> | null;
};

function finiteScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asScanResult(
  result: ScanResult | Record<string, unknown> | null | undefined,
): ScanResult | null {
  if (!result || typeof result !== "object") return null;
  return result as ScanResult;
}

/**
 * PR Risk score authority chain:
 * 1. result.prRisk.score
 * 2. denormalized pr_risk_score (when provided)
 * 3. historical scans.total_score column (when provided)
 * 4. result.totalScore (historical JSON fallback only)
 */
export function resolvePrRiskScore(
  result: ScanResult | null | undefined,
  ctx: PrRiskScoreContext = {},
): number | null {
  if (!result && ctx.prRiskScore == null && ctx.legacyTotalScore == null) {
    return null;
  }

  const fromWire = finiteScore(result?.prRisk?.score);
  if (fromWire != null) return fromWire;

  const fromDenorm = finiteScore(ctx.prRiskScore);
  if (fromDenorm != null) return fromDenorm;

  const fromLegacyColumn = finiteScore(ctx.legacyTotalScore);
  if (fromLegacyColumn != null) return fromLegacyColumn;

  return finiteScore(result?.totalScore);
}

const LAYER_ORDER: ScoreLayer[] = [
  "security",
  "maintainability",
  "ecosystem",
  "upgradeImpact",
];

/** Layer scores for PR Risk — prRisk.layerScores when present, else legacy layerScores. */
export function resolvePrRiskLayerScores(
  result: ScanResult | null | undefined,
): LayerScores | null {
  if (!result) return null;
  const fromPrRisk = result.prRisk?.layerScores;
  if (fromPrRisk) return fromPrRisk;
  if (result.layerScores) return result.layerScores;
  return null;
}

export function resolvePrRiskLayerEntries(
  result: ScanResult | null | undefined,
): Array<{ layer: ScoreLayer; score: number }> {
  const layerScores = resolvePrRiskLayerScores(result);
  if (!layerScores) return [];
  return LAYER_ORDER.map((layer) => ({
    layer,
    score: layerScores[layer],
  }));
}

/**
 * Repository health score authority chain:
 * 1. result.repositoryHealth.totalScore
 * 2. denormalized repository_health_score
 * 3. historical scans.total_score column (non-PR scans only)
 * 4. result.totalScore (non-PR JSON fallback only)
 */
export function resolveRepositoryHealthScore(
  result: ScanResult | null | undefined,
  ctx: RepositoryHealthScoreContext = {},
): number | null {
  if (
    !result &&
    ctx.repositoryHealthScore == null &&
    ctx.legacyTotalScore == null
  ) {
    return null;
  }

  const fromWire = finiteScore(result?.repositoryHealth?.totalScore);
  if (fromWire != null) return fromWire;

  const fromDenorm = finiteScore(ctx.repositoryHealthScore);
  if (fromDenorm != null) return fromDenorm;

  if (ctx.isPrScan) return null;

  const fromLegacyColumn = finiteScore(ctx.legacyTotalScore);
  if (fromLegacyColumn != null) return fromLegacyColumn;

  return finiteScore(result?.totalScore);
}

/** Resolve PR risk from a DB scan row (wire + denorm + historical column). */
export function resolvePrRiskScoreFromRow(row: ScanScoreRow): number | null {
  return resolvePrRiskScore(asScanResult(row.result), {
    prRiskScore: row.pr_risk_score,
    legacyTotalScore: row.total_score,
  });
}

/** Resolve repository health from a DB scan row (wire + denorm + historical column). */
export function resolveRepositoryHealthScoreFromRow(
  row: ScanScoreRow,
): number | null {
  const isPrScan =
    row.github_pr_number != null && Number.isFinite(row.github_pr_number);
  return resolveRepositoryHealthScore(asScanResult(row.result), {
    repositoryHealthScore: row.repository_health_score,
    isPrScan,
    legacyTotalScore: row.total_score,
  });
}
