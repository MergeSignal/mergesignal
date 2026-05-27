import { describe, expect, it } from "vitest";
import {
  deriveCardExposureDisplay,
  exposureAriaFragment,
  formatCardExposureLine,
} from "./formatCardExposureDisplay.js";

describe("deriveCardExposureDisplay", () => {
  it("maps score to five fixed exposure buckets", () => {
    expect(deriveCardExposureDisplay(0)?.category).toBe("minimal");
    expect(deriveCardExposureDisplay(24)?.category).toBe("minimal");
    expect(deriveCardExposureDisplay(25)?.category).toBe("limited");
    expect(deriveCardExposureDisplay(44)?.category).toBe("limited");
    expect(deriveCardExposureDisplay(45)?.category).toBe("moderate");
    expect(deriveCardExposureDisplay(71)?.category).toBe("moderate");
    expect(deriveCardExposureDisplay(74)?.category).toBe("moderate");
    expect(deriveCardExposureDisplay(75)?.category).toBe("elevated");
    expect(deriveCardExposureDisplay(89)?.category).toBe("elevated");
    expect(deriveCardExposureDisplay(90)?.category).toBe("broad");
    expect(deriveCardExposureDisplay(100)?.category).toBe("broad");
  });

  it("clamps and rounds non-finite input away", () => {
    expect(deriveCardExposureDisplay(null)).toBeNull();
    expect(deriveCardExposureDisplay(NaN)).toBeNull();
    expect(deriveCardExposureDisplay(71.6)?.value).toBe(72);
    expect(deriveCardExposureDisplay(150)?.value).toBe(100);
  });
});

describe("formatCardExposureLine", () => {
  it("returns exposure label only", () => {
    expect(formatCardExposureLine(71)).toBe("Moderate exposure");
    expect(formatCardExposureLine(12)).toBe("Minimal exposure");
    expect(formatCardExposureLine(80)).toBe("Elevated exposure");
  });
});

describe("exposureAriaFragment", () => {
  it("returns exposure label only", () => {
    expect(exposureAriaFragment(45)).toBe("Moderate exposure");
    expect(exposureAriaFragment(80)).toBe("Elevated exposure");
  });
});
