import {
  getOwnerFromRepoId,
  getProductOwnerTierForOwner,
  type ProductOwnerTier,
} from "@mergesignal/product-tier";

export type Tier = ProductOwnerTier;

export { getOwnerFromRepoId, getProductOwnerTierForOwner as getTierForOwner };

export type EntitlementPeriod = "week" | "month";

export type TierLimits = {
  scanMaxLockfileBytes: number;
  /** Completed analyses allowed in the current period. Negative means unlimited. */
  scanAllowance: number;
  entitlementPeriod: EntitlementPeriod;
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
    scanAllowance: clampAllowance(process.env.FREE_SCAN_ALLOWANCE, 10),
    entitlementPeriod: "week",
    prCommentsEnabled: (process.env.FREE_PR_COMMENTS_ENABLED ?? "0") === "1",
    alertsEnabled: (process.env.FREE_ALERTS_ENABLED ?? "0") === "1",
  };

  const paid: TierLimits = {
    scanMaxLockfileBytes: clampInt(
      process.env.PAID_SCAN_MAX_LOCKFILE_BYTES,
      5_000_000,
    ),
    scanAllowance: clampAllowance(process.env.PAID_SCAN_ALLOWANCE, 500),
    entitlementPeriod: "month",
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

/** A negative configured allowance remains the existing unlimited sentinel. */
function clampAllowance(v: string | undefined, fallback: number) {
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return -1;
  return Math.floor(n);
}
