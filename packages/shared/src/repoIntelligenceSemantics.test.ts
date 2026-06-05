import { describe, expect, it } from "vitest";

import type { RepoIntelligence } from "./repoIntelligenceSchema.js";
import {
  isRuntimeNarrativeSafe,
  sanitizeRepoIntelligenceSemantics,
} from "./repoIntelligenceSemantics.js";

function basePkg(
  overrides: Partial<RepoIntelligence["packages"][string]> = {},
): RepoIntelligence["packages"][string] {
  return {
    runtimeSurface: "runtime",
    reachability: "unreachable",
    usage: { packageName: "typescript", files: [] },
    ...overrides,
  };
}

describe("sanitizeRepoIntelligenceSemantics", () => {
  it("S1: neutralizes runtime + unreachable", () => {
    const draft: RepoIntelligence = {
      packages: {
        typescript: basePkg({
          runtimeImpact: "unknown",
        }),
      },
    };
    const { wire, diagnostics } = sanitizeRepoIntelligenceSemantics(draft);
    expect(wire.packages.typescript?.runtimeSurface).not.toBe("runtime");
    expect(wire.packages.typescript?.reachability).not.toBe("unreachable");
    expect(wire.packages.typescript?.suppressRuntimeNarrative).toBe(true);
    expect(diagnostics.some((d) => d.ruleId === "S1")).toBe(true);
  });

  it("S3: tooling class cannot stay confirmed", () => {
    const draft: RepoIntelligence = {
      packages: {
        typescript: basePkg({
          dependencyClass: "tooling",
          runtimeImpact: "confirmed",
          runtimeSurface: "build",
          reachability: "build_only",
        }),
      },
    };
    const { wire } = sanitizeRepoIntelligenceSemantics(draft);
    expect(wire.packages.typescript?.runtimeImpact).toBe("none");
  });

  it("S4: confirmed without imports downgrades", () => {
    const draft: RepoIntelligence = {
      packages: {
        fastify: basePkg({
          runtimeImpact: "confirmed",
          usage: { packageName: "fastify", files: [] },
        }),
      },
    };
    const { wire } = sanitizeRepoIntelligenceSemantics(draft);
    expect(wire.packages.fastify?.runtimeImpact).toBe("none");
  });
});

describe("isRuntimeNarrativeSafe", () => {
  it("returns false for suppressed runtime narrative", () => {
    expect(
      isRuntimeNarrativeSafe({
        runtimeSurface: "runtime",
        reachability: "on_runtime_paths",
        usage: { packageName: "x", files: ["src/a.ts"] },
        suppressRuntimeNarrative: true,
        runtimeImpact: "none",
      }),
    ).toBe(false);
  });
});
