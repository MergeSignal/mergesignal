import { describe, expect, it } from "vitest";
import { scoreToBand } from "./prRiskBand.js";
import { buildScanPresentationBundle } from "./presentation/orchestration/buildScanPresentationBundle.js";
import {
  scanResultBullmq,
  scanResultEslint,
  scanResultFastifyRuntime,
  scanResultLimitedContext,
  scanResultMixedTypescriptFastify,
  scanResultPrettier,
  scanResultTypescriptPatch,
  scanResultVitest,
} from "./presentation/fixtures/presentationPersonaFixtures.js";
import type { ScanResult } from "./types.js";

const scoredPrRiskPersonas: Array<{
  id: string;
  result: ScanResult;
  expectedRiskIndex: number;
}> = [
  {
    id: "fastify-runtime",
    result: scanResultFastifyRuntime,
    expectedRiskIndex: 55,
  },
  {
    id: "typescript-patch",
    result: scanResultTypescriptPatch,
    expectedRiskIndex: 30,
  },
  { id: "prettier", result: scanResultPrettier, expectedRiskIndex: 30 },
];

const nonScoredPrRiskPersonas: Array<{ id: string; result: ScanResult }> = [
  { id: "mixed-ts-fastify", result: scanResultMixedTypescriptFastify },
  { id: "bullmq", result: scanResultBullmq },
  { id: "eslint", result: scanResultEslint },
  { id: "vitest", result: scanResultVitest },
  { id: "limited-context", result: scanResultLimitedContext },
];

const validationPersonas: Array<{ id: string; result: ScanResult }> = [
  ...scoredPrRiskPersonas,
  ...nonScoredPrRiskPersonas,
];

function bundleFor(result: ScanResult) {
  return buildScanPresentationBundle({
    result,
    pipelineStatus: "done",
  });
}

describe("scanPresentationBundle golden — proof model", () => {
  it.each(validationPersonas)("builds bundle for $id", ({ result }) => {
    const bundle = bundleFor(result);
    expect(bundle).not.toBeNull();
    expect(bundle!.facts.availability.corpusGateReason).toBeDefined();
    expect(bundle!.facts.confidence).toMatchObject({
      limitedContext: expect.any(Boolean),
    });
  });

  it.each(scoredPrRiskPersonas)(
    "$id: scored persona exposes governed numeric PR Risk",
    ({ result, expectedRiskIndex }) => {
      const { facts } = bundleFor(result)!;
      expect(facts.riskSignals).not.toBeNull();
      expect(facts.riskSignals!.riskIndex).toBe(expectedRiskIndex);
      expect(facts.riskIndex).toBe(expectedRiskIndex);
      expect(facts.riskSignals!.layers).toHaveLength(4);
      expect(facts.riskSignals!.band).toBe(scoreToBand(expectedRiskIndex));
    },
  );

  it.each(nonScoredPrRiskPersonas)(
    "$id: non-scored persona does not expose numeric PR Risk",
    ({ result }) => {
      const { facts } = bundleFor(result)!;
      expect(facts.riskSignals).toBeNull();
      expect(facts.riskIndex).toBeNull();
    },
  );

  it("fastify-runtime — linkage and diagnostics", () => {
    const bundle = bundleFor(scanResultFastifyRuntime)!;
    const { facts } = bundle;

    expect(facts.availability.corpusGateReason).toBe("ok");
    expect(facts.confidence.limitedContext).toBe(false);
    expect(facts.confidence.assessment).toBe("medium");

    const apiArea = facts.affectedAreas.find((a) => a.id === "api");
    expect(apiArea?.packages).toContain("fastify");
    expect(apiArea?.findingIds).toContain("finding-fastify-runtime");
    expect(apiArea?.paths.length).toBeGreaterThan(0);
    expect(apiArea?.hotspotPackages).toContain("fastify");
    expect(apiArea?.verificationFocus.length).toBeGreaterThan(0);

    expect(facts.riskSignals?.riskIndex).toBe(55);
    expect(facts.riskSignals?.band).toBe(scoreToBand(55));
    expect(facts.riskIndex).toBe(facts.riskSignals?.riskIndex);
  });

  it("limited-context — diagnostics without synthetic confidence", () => {
    const bundle = bundleFor(scanResultLimitedContext)!;
    const { facts } = bundle;

    expect(scanResultLimitedContext.prRisk).toEqual({
      availability: "indeterminate",
      qualifier: "limited_evidence",
    });
    expect(facts.riskSignals).toBeNull();
    expect(facts.riskIndex).toBeNull();
    expect(facts.availability.corpusGateReason).toBe("no_code_intelligence");
    expect(
      facts.availability.preparationWarnings.some(
        (w) => w.code === "base_lockfile_missing",
      ),
    ).toBe(true);
    expect(facts.confidence.assessment).toBe("low");
    expect(facts.confidence.limitedContext).toBe(true);
  });

  it("typescript-patch — tooling semantics with risk signals", () => {
    const bundle = bundleFor(scanResultTypescriptPatch)!;
    const { facts } = bundle;

    expect(facts.availability.corpusGateReason).toBe("ok");
    expect(facts.packageSemantics?.dependencyClass).toBe("tooling");
    expect(facts.riskSignals?.riskIndex).toBe(30);
    expect(facts.riskSignals?.band).toBe(scoreToBand(30));
  });

  it("affected areas always carry linkage arrays (structure)", () => {
    for (const { result } of validationPersonas) {
      const bundle = bundleFor(result);
      if (!bundle) continue;
      for (const area of bundle.facts.affectedAreas) {
        expect(Array.isArray(area.packages)).toBe(true);
        expect(Array.isArray(area.findingIds)).toBe(true);
        expect(Array.isArray(area.paths)).toBe(true);
        expect(Array.isArray(area.hotspotPackages)).toBe(true);
        expect(Array.isArray(area.verificationFocus)).toBe(true);
      }
    }
  });
});
