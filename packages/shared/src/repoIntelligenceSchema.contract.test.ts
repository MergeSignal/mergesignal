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

  it("accepts optional lifecycleStages and promotedAreas on package rows (ABI 3)", () => {
    const wire = {
      packages: {
        "acme-runtime-http-lib": {
          runtimeSurface: "runtime",
          reachability: "on_runtime_paths",
          usage: {
            packageName: "acme-runtime-http-lib",
            files: ["apps/api/handlers/entry.ts"],
            areas: [],
          },
          lifecycleStages: [
            {
              stage: "route_registration",
              fileCount: 1,
              evidenceRefs: ["import_path:apps/api/handlers/entry.ts"],
            },
          ],
          promotedAreas: [
            {
              area: "api",
              structuralAnchor: "http_surface",
              evidenceRefs: ["import_path:apps/api/handlers/entry.ts"],
            },
          ],
        },
      },
    };
    const validated = validateRepoIntelligenceWire(wire);
    expect(
      validated.packages["acme-runtime-http-lib"]?.lifecycleStages?.length,
    ).toBe(1);
    expect(
      validated.packages["acme-runtime-http-lib"]?.promotedAreas?.length,
    ).toBe(1);
  });
});
