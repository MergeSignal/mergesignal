import { describe, it, expect } from "vitest";
import {
  deriveCardDisplaySummary,
  isGenericCardSummary,
} from "./deriveCardDisplaySummary.js";
import { truncateCardSummary } from "./truncateCardSummary.js";
import {
  formatCardAreaLabels,
  joinCardAreaLabels,
} from "./formatCardAreaLabels.js";
import { formatCardEvidenceCounts } from "./formatCardEvidenceCounts.js";

describe("isGenericCardSummary", () => {
  it("flags platform boilerplate", () => {
    expect(isGenericCardSummary("Potential runtime impact detected")).toBe(
      true,
    );
    expect(
      isGenericCardSummary(
        "No high-confidence merge risk from dependency change",
      ),
    ).toBe(true);
    expect(
      isGenericCardSummary(
        "No high-confidence merge risks from this PR dependency change",
      ),
    ).toBe(true);
  });

  it("allows concrete operational copy", () => {
    expect(
      isGenericCardSummary(
        "This upgrade changes websocket reconnect timing in the API layer",
      ),
    ).toBe(false);
  });
});

describe("truncateCardSummary", () => {
  it("truncates at sentence boundary when possible", () => {
    const text =
      "First sentence is clear. Second sentence adds more detail that should be cut.";
    const out = truncateCardSummary(text, 50);
    expect(out).toBe("First sentence is clear.");
  });

  it("uses ellipsis at word boundary", () => {
    const text =
      "This upgrade changes retry behavior in payment polling handlers";
    const out = truncateCardSummary(text, 40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(43);
  });
});

describe("formatCardAreaLabels", () => {
  it("drops paths and generic taxonomy", () => {
    expect(
      formatCardAreaLabels([
        "packages/web/src/auth",
        "Auth flows",
        "Session refresh flow",
      ]),
    ).toEqual(["Session refresh flow"]);
  });

  it("prefers longer specific labels", () => {
    const out = formatCardAreaLabels(["API routes", "Payment retry handling"]);
    expect(out[0]).toBe("Payment retry handling");
  });
});

describe("deriveCardDisplaySummary", () => {
  const emptyCounts = { critical: 0, high: 0, medium: 0, low: 0 };

  it("returns null for quiet safe cards", () => {
    expect(
      deriveCardDisplaySummary({
        mergePosture: "safe",
        rawSummary: "No merge blockers detected",
        findingCounts: emptyCounts,
        topAffectedAreas: [],
      }),
    ).toBeNull();
  });

  it("surfaces affected areas on quiet safe cards when specific", () => {
    expect(
      deriveCardDisplaySummary({
        mergePosture: "safe",
        rawSummary: "No high-confidence merge risks",
        findingCounts: emptyCounts,
        topAffectedAreas: ["Session refresh flow"],
      }),
    ).toBe("Session refresh flow");
  });

  it("uses specific reasoning for risky", () => {
    expect(
      deriveCardDisplaySummary({
        mergePosture: "risky",
        rawSummary: "Auth boundary change in session middleware",
        findingCounts: { ...emptyCounts, high: 1 },
        topAffectedAreas: [],
      }),
    ).toBe("Auth boundary change in session middleware");
  });

  it("falls back to formatted areas when reasoning is generic", () => {
    expect(
      deriveCardDisplaySummary({
        mergePosture: "needs_review",
        rawSummary: "Potential runtime impact detected",
        findingCounts: emptyCounts,
        topAffectedAreas: ["Payment retry handling", "Auth flows"],
      }),
    ).toBe("Payment retry handling");
  });
});

describe("formatCardEvidenceCounts", () => {
  it("uses soft phrasing for risky critical", () => {
    expect(
      formatCardEvidenceCounts(
        { critical: 2, high: 0, medium: 0, low: 0 },
        "risky",
      ),
    ).toBe("Critical findings present");
  });

  it("returns null for safe", () => {
    expect(
      formatCardEvidenceCounts(
        { critical: 1, high: 1, medium: 0, low: 0 },
        "safe",
      ),
    ).toBeNull();
  });
});

describe("joinCardAreaLabels", () => {
  it("joins with middle dot", () => {
    expect(
      joinCardAreaLabels(["Session refresh flow", "Checkout handlers"]),
    ).toBe("Session refresh flow · Checkout handlers");
  });
});
