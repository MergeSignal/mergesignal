import { describe, expect, it } from "vitest";

import {
  getProductOwnerTierForOwner,
  getOwnerFromRepoId,
} from "./productOwnerTier.js";
import { resolveReasoningBudgetTierForOwner } from "./reasoningBudgetTierForOwner.js";

describe("product owner tier", () => {
  it("parses owner from repo id", () => {
    expect(getOwnerFromRepoId("acme/app")).toBe("acme");
  });

  it("uses MERGESIGNAL_OWNER_TIERS override for paid", () => {
    expect(
      getProductOwnerTierForOwner("acme", {
        MERGESIGNAL_OWNER_TIERS: "acme=paid",
      }),
    ).toBe("paid");
  });

  it("uses MERGESIGNAL_OWNER_TIERS override for free", () => {
    expect(
      getProductOwnerTierForOwner("acme", {
        MERGESIGNAL_OWNER_TIERS: "acme=free",
      }),
    ).toBe("free");
  });

  it("defaults to free for unknown owner", () => {
    expect(getProductOwnerTierForOwner("unknown", {})).toBe("free");
  });

  it("honors MERGESIGNAL_DEFAULT_TIER=paid for unknown owners", () => {
    expect(
      getProductOwnerTierForOwner("unknown", {
        MERGESIGNAL_DEFAULT_TIER: "paid",
      }),
    ).toBe("paid");
  });

  it("does not grant paid from malformed owner-tier mapping", () => {
    expect(
      getProductOwnerTierForOwner("acme", {
        MERGESIGNAL_OWNER_TIERS: "acme=paid=extra",
      }),
    ).toBe("free");
  });
});

describe("reasoning budget tier for owner", () => {
  it("maps paid product tier to pro reasoning tier", () => {
    expect(
      resolveReasoningBudgetTierForOwner("acme", {
        MERGESIGNAL_OWNER_TIERS: "acme=paid",
      }),
    ).toBe("pro");
  });

  it("maps free product tier to free reasoning tier", () => {
    expect(resolveReasoningBudgetTierForOwner("acme", {})).toBe("free");
  });

  it("maps default paid product tier to pro reasoning", () => {
    expect(
      resolveReasoningBudgetTierForOwner("unknown", {
        MERGESIGNAL_DEFAULT_TIER: "paid",
      }),
    ).toBe("pro");
  });
});
