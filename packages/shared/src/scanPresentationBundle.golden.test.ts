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

const validationPersonas: Array<{ id: string; result: ScanResult }> = [
  { id: "fastify-runtime", result: scanResultFastifyRuntime },
  { id: "typescript-patch", result: scanResultTypescriptPatch },
  { id: "mixed-ts-fastify", result: scanResultMixedTypescriptFastify },
  { id: "prettier", result: scanResultPrettier },
  { id: "bullmq", result: scanResultBullmq },
  { id: "eslint", result: scanResultEslint },
  { id: "vitest", result: scanResultVitest },
  { id: "limited-context", result: scanResultLimitedContext },
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
    expect(bundle!.facts.riskSignals).not.toBeNull();
    expect(bundle!.facts.riskSignals!.layers).toHaveLength(4);
  });

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
    expect(facts.riskSignals?.riskIndex).toBe(18);
    expect(facts.riskSignals?.band).toBe(scoreToBand(18));
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
