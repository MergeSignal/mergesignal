import {
  getOwnerFromRepoId,
  getProductOwnerTierForOwner,
  type ProductOwnerTier,
} from "@mergesignal/product-tier";

export type Tier = ProductOwnerTier;

export { getOwnerFromRepoId, getProductOwnerTierForOwner as getTierForOwner };

export type TierLimits = {
  scanMaxLockfileBytes: number;
  scansPerOwnerPerDay: number;
  githubScansPerOwnerPerDay: number;
  prCommentsEnabled: boolean;
  alertsEnabled: boolean;
};

export function getLimitsForOwner(owner: string): TierLimits {
  const tier = getProductOwnerTierForOwner(owner);

  const free: TierLimits = {
    scanMaxLockfileBytes: clampInt(
      process.env.FREE_SCAN_MAX_LOCKFILE_BYTES,
      1_000_000,
    ),
    scansPerOwnerPerDay: clampInt(process.env.FREE_SCANS_PER_OWNER_PER_DAY, 25),
    githubScansPerOwnerPerDay: clampInt(
      process.env.FREE_GITHUB_SCANS_PER_OWNER_PER_DAY,
      15,
    ),
    prCommentsEnabled: (process.env.FREE_PR_COMMENTS_ENABLED ?? "0") === "1",
    alertsEnabled: (process.env.FREE_ALERTS_ENABLED ?? "0") === "1",
  };

  const paid: TierLimits = {
    scanMaxLockfileBytes: clampInt(
      process.env.PAID_SCAN_MAX_LOCKFILE_BYTES,
      5_000_000,
    ),
    scansPerOwnerPerDay: clampInt(
      process.env.PAID_SCANS_PER_OWNER_PER_DAY,
      2_000,
    ),
    githubScansPerOwnerPerDay: clampInt(
      process.env.PAID_GITHUB_SCANS_PER_OWNER_PER_DAY,
      2_000,
    ),
    prCommentsEnabled: true,
    alertsEnabled: true,
  };

  return tier === "paid" ? paid : free;
}

function clampInt(v: string | undefined, fallback: number) {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}
