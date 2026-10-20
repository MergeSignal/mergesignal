import { afterEach, describe, expect, it } from "vitest";
import { getLimitsForOwner } from "./tier.js";

describe("scan allowance policy", () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env.FREE_SCAN_ALLOWANCE = previous.FREE_SCAN_ALLOWANCE;
    process.env.PAID_SCAN_ALLOWANCE = previous.PAID_SCAN_ALLOWANCE;
    process.env.MERGESIGNAL_OWNER_TIERS = previous.MERGESIGNAL_OWNER_TIERS;
    process.env.MERGESIGNAL_DEFAULT_TIER = previous.MERGESIGNAL_DEFAULT_TIER;
  });

  it("defaults free to 10 per week and paid to 500 per month", () => {
    delete process.env.FREE_SCAN_ALLOWANCE;
    delete process.env.PAID_SCAN_ALLOWANCE;
    delete process.env.MERGESIGNAL_OWNER_TIERS;
    process.env.MERGESIGNAL_DEFAULT_TIER = "free";

    expect(getLimitsForOwner("acme")).toMatchObject({
      scanAllowance: 10,
      entitlementPeriod: "week",
    });

    process.env.MERGESIGNAL_OWNER_TIERS = "acme=paid";
    expect(getLimitsForOwner("acme")).toMatchObject({
      scanAllowance: 500,
      entitlementPeriod: "month",
    });
    expect(getLimitsForOwner("other")).toMatchObject({
      scanAllowance: 10,
      entitlementPeriod: "week",
    });
  });

  it("treats a negative allowance as unlimited", () => {
    delete process.env.MERGESIGNAL_OWNER_TIERS;
    process.env.MERGESIGNAL_DEFAULT_TIER = "free";
    process.env.FREE_SCAN_ALLOWANCE = "-1";
    expect(getLimitsForOwner("acme").scanAllowance).toBe(-1);
  });
});
