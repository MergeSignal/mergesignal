import { describe, expect, it } from "vitest";
import { mergePostureFromDecision } from "./riskVocabulary.js";

describe("mergePostureFromDecision", () => {
  it("accepts only canonical lowercase merge posture tokens", () => {
    expect(mergePostureFromDecision("safe")).toBe("safe");
    expect(mergePostureFromDecision("needs_review")).toBe("needs_review");
    expect(mergePostureFromDecision("risky")).toBe("risky");
  });

  it("rejects alternate engine spellings (no silent normalization)", () => {
    expect(mergePostureFromDecision("SAFE")).toBeNull();
    expect(mergePostureFromDecision("RISKY")).toBeNull();
    expect(mergePostureFromDecision("BLOCK")).toBeNull();
  });
});
