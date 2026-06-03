import { describe, expect, it } from "vitest";
import { normalizeGeneratedText } from "./normalizeGeneratedText.js";
import { scanSurfaceCopyFlat } from "./scanSurfaceCopy.js";

describe("normalizeGeneratedText", () => {
  it("replaces typographic dashes with ASCII hyphen-minus", () => {
    expect(normalizeGeneratedText("foo – bar — baz")).toBe("foo - bar - baz");
    expect(normalizeGeneratedText("a&mdash;b&ndash;c")).toBe("a-b-c");
  });

  it("leaves ASCII text unchanged", () => {
    expect(normalizeGeneratedText("Safe - Needs review")).toBe(
      "Safe - Needs review",
    );
  });

  it("scanSurfaceCopy flat strings are ASCII-safe", () => {
    const asciiOnly = /^[\x00-\x7F]*$/;
    for (const value of Object.values(scanSurfaceCopyFlat())) {
      expect(asciiOnly.test(value), value).toBe(true);
    }
  });
});
