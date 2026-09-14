/** Product billing tier for a repository owner (API and worker policy). */

export type ProductOwnerTier = "free" | "paid";

export function getOwnerFromRepoId(repoId: string): string {
  const s = String(repoId ?? "").trim();
  if (!s) return "unknown";
  const i = s.indexOf("/");
  return i >= 0 ? s.slice(0, i) : s;
}

function parseOwnerTiers(raw: string): Map<string, ProductOwnerTier> {
  const out = new Map<string, ProductOwnerTier>();
  for (const part of raw.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    const kRaw = p.slice(0, eq).trim();
    const vRaw = p.slice(eq + 1).trim();
    if (!kRaw || !vRaw) continue;
    out.set(kRaw, vRaw.toLowerCase() === "paid" ? "paid" : "free");
  }
  return out;
}

/** MERGESIGNAL_OWNER_TIERS / MERGESIGNAL_DEFAULT_TIER product authority. */
export function getProductOwnerTierForOwner(
  owner: string,
  env: NodeJS.ProcessEnv = process.env,
): ProductOwnerTier {
  const map = parseOwnerTiers(env.MERGESIGNAL_OWNER_TIERS ?? "");
  const explicit = map.get(owner);
  if (explicit) return explicit;
  const def = String(env.MERGESIGNAL_DEFAULT_TIER ?? "free").toLowerCase();
  return def === "paid" ? "paid" : "free";
}
