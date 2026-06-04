import { describe, expect, it } from "vitest";
import {
  fixtureRepoIntelligenceFastify,
  fixtureRepoIntelligenceMultiPackage,
} from "./fixtures/repoIntelligenceFixtures.js";
import { legacyEngineRepoIntelligenceJwt } from "./fixtures/legacyEngineRepoIntelligence.js";
import {
  safeParseRepoIntelligence,
  validateRepoIntelligenceWire,
} from "./repoIntelligenceSchema.js";

describe("repoIntelligenceWireSchema contract", () => {
  it("accepts canonical consumer fixtures", () => {
    expect(() =>
      validateRepoIntelligenceWire(fixtureRepoIntelligenceFastify),
    ).not.toThrow();
    expect(() =>
      validateRepoIntelligenceWire(fixtureRepoIntelligenceMultiPackage),
    ).not.toThrow();
  });

  it("rejects legacy engine wire (name, large blast, object frameworks, file hotspots)", () => {
    const r = safeParseRepoIntelligence(legacyEngineRepoIntelligenceJwt);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issueCount).toBeGreaterThan(0);
    const joined = r.issues.join(" ");
    expect(joined.length).toBeGreaterThan(0);
  });
});
