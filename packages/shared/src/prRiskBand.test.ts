import { describe, expect, it } from "vitest";
import {
  PR_RISK_BAND_ABI,
  PR_RISK_BAND_THRESHOLDS,
  formatPrRiskSummary,
  prRiskBandAriaFragment,
  prRiskBandLabel,
  prRiskBandToGaugeBand,
  scoreToBand,
  scoreToBandLabel,
} from "./prRiskBand.js";

describe("PR_RISK_BAND_ABI", () => {
  it("is stable v1", () => {
    expect(PR_RISK_BAND_ABI).toBe("1");
    expect(PR_RISK_BAND_THRESHOLDS).toEqual([19, 44, 64, 84, 100]);
  });
});

describe("scoreToBand", () => {
  it("maps approved boundary cut points", () => {
    expect(scoreToBand(0)).toBe("very_low");
    expect(scoreToBand(19)).toBe("very_low");
    expect(scoreToBand(20)).toBe("low");
    expect(scoreToBand(44)).toBe("low");
    expect(scoreToBand(45)).toBe("medium");
    expect(scoreToBand(64)).toBe("medium");
    expect(scoreToBand(65)).toBe("high");
    expect(scoreToBand(84)).toBe("high");
    expect(scoreToBand(85)).toBe("critical");
    expect(scoreToBand(100)).toBe("critical");
  });

  it("returns null for invalid input", () => {
    expect(scoreToBand(null)).toBeNull();
    expect(scoreToBand(NaN)).toBeNull();
  });

  it("clamps out-of-range values", () => {
    expect(scoreToBand(150)).toBe("critical");
    expect(scoreToBand(-5)).toBe("very_low");
    expect(scoreToBand(71.6)).toBe("high");
  });
});

describe("scoreToBandLabel", () => {
  it("returns presentation labels", () => {
    expect(scoreToBandLabel(10)).toBe("Very Low");
    expect(scoreToBandLabel(55)).toBe("Medium");
    expect(scoreToBandLabel(90)).toBe("Critical");
  });
});

describe("prRiskBandLabel", () => {
  it("labels enum values", () => {
    expect(prRiskBandLabel("medium")).toBe("Medium");
  });
});

describe("prRiskBandAriaFragment", () => {
  it("prefixes PR Risk", () => {
    expect(prRiskBandAriaFragment(55)).toBe("PR Risk: Medium");
  });
});

describe("formatPrRiskSummary", () => {
  it("returns score and band label from riskSignals", () => {
    expect(
      formatPrRiskSummary({
        riskSignals: { riskIndex: 55, band: "medium", layers: [] },
        riskIndex: 55,
      }),
    ).toEqual({ prRiskScore: 55, prRiskBandLabel: "Medium" });
  });

  it("returns undefined when risk index is missing", () => {
    expect(
      formatPrRiskSummary({ riskSignals: null, riskIndex: null }),
    ).toBeUndefined();
  });
});

describe("prRiskBandToGaugeBand", () => {
  it("projects to three gauge buckets", () => {
    expect(prRiskBandToGaugeBand("very_low")).toBe("low");
    expect(prRiskBandToGaugeBand("low")).toBe("low");
    expect(prRiskBandToGaugeBand("medium")).toBe("moderate");
    expect(prRiskBandToGaugeBand("high")).toBe("high");
    expect(prRiskBandToGaugeBand("critical")).toBe("high");
  });
});
