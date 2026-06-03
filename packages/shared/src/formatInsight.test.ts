import { describe, expect, it } from "vitest";
import { formatInsight, renderInsightsAsMarkdown } from "./formatInsight.js";
import type { PRInsight, PRDecision } from "./types.js";

function makeInsight(overrides: Partial<PRInsight> = {}): PRInsight {
  return {
    type: "behavioral_change",
    priority: "high",
    confidence: "confirmed",
    scope: "changed",
    message: "default message",
    context: "default context",
    remediation: "default remediation",
    ...overrides,
  };
}

describe("formatInsight", () => {
  describe("typographic dash normalization", () => {
    it("replaces em dashes with ASCII hyphens in message", () => {
      const result = formatInsight(makeInsight({ message: "A \u2014 B" }));
      expect(result.message).toBe("A - B");
    });

    it("replaces en dashes with ASCII hyphens in message", () => {
      const result = formatInsight(makeInsight({ message: "A \u2013 B" }));
      expect(result.message).toBe("A - B");
    });

    it("normalizes all three fields: message, context, remediation", () => {
      const result = formatInsight(
        makeInsight({
          message: "A \u2014 B",
          context: "C \u2013 D",
          remediation: "E \u2014 F",
        }),
      );
      expect(result.message).toBe("A - B");
      expect(result.where).toBe("C - D");
      expect(result.action).toBe("E - F");
    });

    it("handles multiple dashes in a single field", () => {
      const result = formatInsight(
        makeInsight({ message: "X \u2014 Y \u2013 Z" }),
      );
      expect(result.message).toBe("X - Y - Z");
    });
  });

  describe("XSS payload pass-through", () => {
    it("does not alter script tag payloads — escaping is the renderer's job", () => {
      const payload = "<script>alert(1)</script>";
      const result = formatInsight(makeInsight({ message: payload }));
      expect(result.message).toBe(payload);
    });

    it("does not alter img onerror payloads", () => {
      const payload = "<img src=x onerror=alert(1)>";
      const result = formatInsight(makeInsight({ context: payload }));
      expect(result.where).toBe(payload);
    });

    it("does not alter javascript: URL payloads", () => {
      const payload = "[x](javascript:alert(1))";
      const result = formatInsight(makeInsight({ remediation: payload }));
      expect(result.action).toBe(payload);
    });
  });

  describe("edge cases", () => {
    it("handles empty strings in all fields without throwing", () => {
      const result = formatInsight(
        makeInsight({ message: "", context: "", remediation: "" }),
      );
      expect(result.message).toBe("");
      expect(result.where).toBe("");
      expect(result.action).toBe("");
    });

    it("maps fields correctly: context → where, remediation → action", () => {
      const result = formatInsight(
        makeInsight({ message: "msg", context: "ctx", remediation: "fix" }),
      );
      expect(result.message).toBe("msg");
      expect(result.where).toBe("ctx");
      expect(result.action).toBe("fix");
    });
  });
});

describe("renderInsightsAsMarkdown", () => {
  const decision: PRDecision = {
    recommendation: "needs_review",
    confidence: "high",
    reasoning: ["reason 1"],
  };

  it("does not alter or escape XSS payloads — sanitization is deferred to MarkdownContent", () => {
    const xssPayload = "<script>alert(1)</script>";
    const insight = makeInsight({ message: xssPayload });
    const output = renderInsightsAsMarkdown([insight], decision);
    expect(output).toContain(xssPayload);
  });

  it("includes the decision title and all insight fields", () => {
    const insight = makeInsight({
      message: "msg text",
      context: "ctx text",
      remediation: "fix text",
    });
    const output = renderInsightsAsMarkdown([insight], decision);
    expect(output).toContain("Needs review");
    expect(output).toContain("msg text");
    expect(output).toContain("ctx text");
    expect(output).toContain("fix text");
  });

  it("normalizes typographic dashes in rendered markdown output", () => {
    const insight = makeInsight({ message: "A \u2014 B" });
    const output = renderInsightsAsMarkdown([insight], decision);
    expect(output).toContain("A - B");
    expect(output).not.toContain("\u2014");
  });
});
