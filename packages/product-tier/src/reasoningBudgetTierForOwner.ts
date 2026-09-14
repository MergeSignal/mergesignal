import {
  getOwnerFromRepoId,
  getProductOwnerTierForOwner,
} from "./productOwnerTier.js";

/** Matches @mergesignal/contracts REASONING_BUDGET_TIERS without a contracts dependency. */
export type ReasoningBudgetTier = "free" | "pro" | "enterprise";

/**
 * Maps product owner tier to engine reasoning budget tier.
 * Product tier has no separate enterprise SKU today; enterprise reasoning requires
 * an explicit future product authority — not inferred here.
 */
export function resolveReasoningBudgetTierForOwner(
  owner: string,
  env: NodeJS.ProcessEnv = process.env,
): ReasoningBudgetTier {
  const productTier = getProductOwnerTierForOwner(owner, env);
  if (productTier === "paid") return "pro";
  return "free";
}

export function resolveReasoningBudgetTierForRepoId(
  repoId: string,
  env: NodeJS.ProcessEnv = process.env,
): ReasoningBudgetTier {
  return resolveReasoningBudgetTierForOwner(getOwnerFromRepoId(repoId), env);
}
