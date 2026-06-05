import { describe, expect, it } from "vitest";
import {
  applyPostureVocabularyGuardHeadline,
  applyPostureVocabularyGuardLines,
  guardHeadlineForPosture,
} from "./applyPostureVocabularyGuard.js";

describe("applyPostureVocabularyGuard", () => {
  it("substitutes safe headline when review language present", () => {
    const out = guardHeadlineForPosture(
      "typescript dependency upgrade needs review",
      "safe",
      "typescript",
    );
    expect(out.toLowerCase()).not.toContain("needs review");
    expect(out.toLowerCase()).toContain("typescript");
  });

  it("filters safe-forbidden key points", () => {
    const lines = applyPostureVocabularyGuardLines(
      ["No runtime usage paths detected", "High risk upgrade path"],
      "safe",
    );
    expect(lines).toContain("No runtime usage paths detected");
    expect(lines.some((l) => /high risk/i.test(l))).toBe(false);
  });

  it("filters needs_review forbidden verification", () => {
    const lines = applyPostureVocabularyGuardLines(
      ["Confirm CI passes", "No action required"],
      "needs_review",
    );
    expect(lines).toContain("Confirm CI passes");
    expect(lines.some((l) => /no action required/i.test(l))).toBe(false);
  });

  it("allows review headline for needs_review posture", () => {
    const out = applyPostureVocabularyGuardHeadline(
      "lodash dependency upgrade needs review",
      "needs_review",
      "lodash",
    );
    expect(out).toContain("needs review");
  });
});
