import { describe, expect, it } from "vitest";
import { deriveScanNarrative } from "../../deriveScanNarrative.js";
import {
  scanResultMixedTypescriptFastify,
  scanResultTypescriptPatch,
  scanResultFastifyRuntime,
} from "../fixtures/presentationPersonaFixtures.js";
import { derivePresentationInterpretation } from "./derivePresentationInterpretation.js";

describe("derivePresentationInterpretation", () => {
  it("typescript patch: tooling_patch intent from engine semantics", () => {
    const facts = deriveScanNarrative(scanResultTypescriptPatch);
    const interp = derivePresentationInterpretation(facts);
    // Engine: suppressRuntimeNarrative=true, expectedImpact=typecheck, dependencyClass=tooling
    expect(interp.intent).toBe("tooling_patch");
    expect(interp.anchorPackage).toBe("typescript");
    expect(interp.suppressRuntimeNarrative).toBe(true);
  });

  it("fastify: runtime_upgrade from runtimeImpact=confirmed", () => {
    const facts = deriveScanNarrative(scanResultFastifyRuntime);
    const interp = derivePresentationInterpretation(facts);
    expect(interp.intent).toBe("runtime_upgrade");
    expect(interp.anchorPackage).toBe("fastify");
    expect(interp.allowRuntimeNarrative).toBe(true);
  });

  it("mixed typescript+fastify: runtime dominates tooling (anchor fastify)", () => {
    const facts = deriveScanNarrative(scanResultMixedTypescriptFastify);
    const interp = derivePresentationInterpretation(facts);
    expect(interp.intent).toBe("runtime_upgrade");
    expect(interp.anchorPackage).toBe("fastify");
    expect(interp.runtimePackages).toContain("fastify");
    expect(interp.runtimePackages).not.toContain("typescript");
  });
});
