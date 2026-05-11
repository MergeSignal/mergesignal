import { describe, it, expect } from "vitest";
import {
  safeParseScanResult,
  parseScanResultOrThrow,
  scanResultSchema,
} from "./scanResultSchema.js";

const minimalValid = {
  totalScore: 42,
  layerScores: {
    security: 10,
    maintainability: 20,
    ecosystem: 30,
    upgradeImpact: 40,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("scanResultSchema", () => {
  it("accepts a minimal valid payload", () => {
    const r = safeParseScanResult(minimalValid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.totalScore).toBe(42);
  });

  it("preserves unknown top-level keys (passthrough)", () => {
    const r = safeParseScanResult({
      ...minimalValid,
      futureEngineField: { x: 1 },
    });
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(
        (r.result as { futureEngineField?: unknown }).futureEngineField,
      ).toEqual({
        x: 1,
      });
  });

  it("rejects missing layerScores", () => {
    const r = safeParseScanResult({
      totalScore: 1,
      findings: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range totalScore", () => {
    const r = safeParseScanResult({
      ...minimalValid,
      totalScore: 101,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects invalid decision.recommendation", () => {
    const r = safeParseScanResult({
      ...minimalValid,
      decision: { recommendation: "maybe", reasoning: [] },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects empty generatedAt", () => {
    const r = safeParseScanResult({
      ...minimalValid,
      generatedAt: "",
    });
    expect(r.ok).toBe(false);
  });

  it("parseScanResultOrThrow returns on success", () => {
    expect(parseScanResultOrThrow(minimalValid).totalScore).toBe(42);
  });

  it("parseScanResultOrThrow throws with validation prefix", () => {
    expect(() => parseScanResultOrThrow({})).toThrow(/^validation:/);
  });

  it("scanResultSchema default empty findings when omitted", () => {
    const { findings: _f, ...rest } = minimalValid;
    const parsed = scanResultSchema.parse(rest);
    expect(parsed.findings).toEqual([]);
  });
});
