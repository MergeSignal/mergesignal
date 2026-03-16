export type Tier = "free" | "paid";

export type TierLimits = {
  prCommentsEnabled: boolean;
  alertsEnabled: boolean;
  alertsBatchLimit: number;
  alertsConcurrency: number;
  alertsMinScoreImpact: number;
  prCommentMaxFindings: number;
  prCommentMaxActions: number;
  prCommentShowDetailsLink: boolean;
  engineMaxFindings: number;
  engineMaxRecommendations: number;
  engineMaxDeepestDeps: number;
  engineMaxHotspots: number;
  engineMaxVulnerable: number;
};

export function getOwnerFromRepoId(repoId: string) {
  const s = String(repoId ?? "").trim();
  if (!s) return "unknown";
  const i = s.indexOf("/");
  return i >= 0 ? s.slice(0, i) : s;
}

export function getTierForOwner(owner: string): Tier {
  const map = parseOwnerTiers(process.env.REPOSENTINEL_OWNER_TIERS ?? "");
  const explicit = map.get(owner);
  if (explicit) return explicit;
  const def = String(process.env.REPOSENTINEL_DEFAULT_TIER ?? "free").toLowerCase();
  return def === "paid" ? "paid" : "free";
}

export function getLimitsForOwner(owner: string): TierLimits {
  const tier = getTierForOwner(owner);

  const free: TierLimits = {
    prCommentsEnabled: (process.env.FREE_PR_COMMENTS_ENABLED ?? "0") === "1",
    alertsEnabled: (process.env.FREE_ALERTS_ENABLED ?? "0") === "1",
    alertsBatchLimit: clampInt(process.env.FREE_ALERTS_BATCH_LIMIT, 5),
    alertsConcurrency: clampInt(process.env.FREE_ALERTS_CONCURRENCY, 1),
    alertsMinScoreImpact: clampInt(process.env.FREE_ALERTS_MIN_SCORE_IMPACT, 12),
    prCommentMaxFindings: clampInt(process.env.FREE_PR_COMMENT_MAX_FINDINGS, 2),
    prCommentMaxActions: clampInt(process.env.FREE_PR_COMMENT_MAX_ACTIONS, 2),
    prCommentShowDetailsLink: (process.env.FREE_PR_COMMENT_SHOW_DETAILS_LINK ?? "1") === "1",
    engineMaxFindings: clampInt(process.env.FREE_ENGINE_MAX_FINDINGS, 3),
    engineMaxRecommendations: clampInt(process.env.FREE_ENGINE_MAX_RECOMMENDATIONS, 3),
    engineMaxDeepestDeps: clampInt(process.env.FREE_ENGINE_MAX_DEEPEST_DEPS, 2),
    engineMaxHotspots: clampInt(process.env.FREE_ENGINE_MAX_HOTSPOTS, 2),
    engineMaxVulnerable: clampInt(process.env.FREE_ENGINE_MAX_VULNERABLE, 2),
  };

  const paid: TierLimits = {
    prCommentsEnabled: true,
    alertsEnabled: true,
    alertsBatchLimit: clampInt(process.env.PAID_ALERTS_BATCH_LIMIT, 50),
    alertsConcurrency: clampInt(process.env.PAID_ALERTS_CONCURRENCY, 4),
    alertsMinScoreImpact: clampInt(process.env.PAID_ALERTS_MIN_SCORE_IMPACT, 8),
    prCommentMaxFindings: clampInt(process.env.PAID_PR_COMMENT_MAX_FINDINGS, 3),
    prCommentMaxActions: clampInt(process.env.PAID_PR_COMMENT_MAX_ACTIONS, 3),
    prCommentShowDetailsLink: (process.env.PAID_PR_COMMENT_SHOW_DETAILS_LINK ?? "1") === "1",
    engineMaxFindings: clampInt(process.env.PAID_ENGINE_MAX_FINDINGS, 5),
    engineMaxRecommendations: clampInt(process.env.PAID_ENGINE_MAX_RECOMMENDATIONS, 5),
    engineMaxDeepestDeps: clampInt(process.env.PAID_ENGINE_MAX_DEEPEST_DEPS, 3),
    engineMaxHotspots: clampInt(process.env.PAID_ENGINE_MAX_HOTSPOTS, 3),
    engineMaxVulnerable: clampInt(process.env.PAID_ENGINE_MAX_VULNERABLE, 3),
  };

  return tier === "paid" ? paid : free;
}

function parseOwnerTiers(s: string) {
  const out = new Map<string, Tier>();
  for (const part of s.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const [kRaw, vRaw] = p.split("=").map((x) => x.trim());
    if (!kRaw || !vRaw) continue;
    const v = vRaw.toLowerCase();
    out.set(kRaw, v === "paid" ? "paid" : "free");
  }
  return out;
}

function clampInt(v: string | undefined, fallback: number) {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

