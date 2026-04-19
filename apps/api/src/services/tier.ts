export type Tier = "free" | "paid";

export type TierLimits = {
  scanMaxLockfileBytes: number;
  scansPerOwnerPerDay: number;
  githubScansPerOwnerPerDay: number;
  prCommentsEnabled: boolean;
  alertsEnabled: boolean;
};

export function getOwnerFromRepoId(repoId: string) {
  const s = String(repoId ?? "").trim();
  if (!s) return "unknown";
  const i = s.indexOf("/");
  return i >= 0 ? s.slice(0, i) : s;
}

export function getTierForOwner(owner: string): Tier {
  const map = parseOwnerTiers(process.env.MERGESIGNAL_OWNER_TIERS ?? "");
  const explicit = map.get(owner);
  if (explicit) return explicit;
  const def = String(
    process.env.MERGESIGNAL_DEFAULT_TIER ?? "free",
  ).toLowerCase();
  return def === "paid" ? "paid" : "free";
}

export function getLimitsForOwner(owner: string): TierLimits {
  const tier = getTierForOwner(owner);

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
