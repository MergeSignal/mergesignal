import { describe, expect, it } from "vitest";
import { deriveScanNarrative } from "./deriveScanNarrative.js";
import { fixtureRepoIntelligenceFastify } from "./fixtures/repoIntelligenceFixtures.js";
import { analysisPreparationWithValidRepoIntel } from "./fixtures/repoIntelligenceTestHelpers.js";
import {
  composeContextLineFromFacts,
  composeVerificationPrompt,
  formatChangedPackagesShort,
  formatUsageSummaryLine,
  summarizePackageUsage,
} from "./narrativePresentation.js";
import { assessmentFastifyRuntime } from "./fixtures/assessmentFixtures.js";
import type { ScanResult } from "./types.js";

const baseResult = {
  totalScore: 10,
  layerScores: {
    security: 1,
    maintainability: 2,
    ecosystem: 3,
    upgradeImpact: 4,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
} satisfies ScanResult;

describe("narrativePresentation", () => {
  it("formats changed packages with second name when only one other", () => {
    const facts = deriveScanNarrative({
      ...baseResult,
      changedPackages: ["lodash", "axios"],
    });
    expect(formatChangedPackagesShort(facts, 2)).toBe("lodash, axios");
  });

  it("summarizes package usage paths from facts", () => {
    const facts = deriveScanNarrative({
      ...baseResult,
      changedPackages: ["fastify"],
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
      repoIntelligence: fixtureRepoIntelligenceFastify,
    });
    const usage = summarizePackageUsage(facts);
    expect(usage?.pathCount).toBeGreaterThan(0);
    expect(formatUsageSummaryLine(facts)).toMatch(/Used in/);
  });

  it("composes verification from remediation when present", () => {
    const facts = deriveScanNarrative({
      ...baseResult,
      changedPackages: ["pkg"],
      insights: [
        {
          type: "usage_risk",
          priority: "high",
          confidence: "confirmed",
          scope: "changed",
          message: "Risk in billing",
          context: "billing",
          remediation: "Run export job smoke test",
        },
      ],
    });
    expect(composeVerificationPrompt(facts)).toBe("Run export job smoke test");
  });

  it("composeContextLineFromFacts honors hidden reach via projected facts policy", () => {
    const facts = deriveScanNarrative({
      ...baseResult,
      changedPackages: ["fastify"],
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
      repoIntelligence: fixtureRepoIntelligenceFastify,
      assessment: {
        ...assessmentFastifyRuntime,
        presentation: {
          ...assessmentFastifyRuntime.presentation,
          reachVisibility: "hidden",
        },
      },
    });
    expect(facts.reachVisibility).toBe("hidden");
    expect(facts.runtimeSurface?.kind).toBe("runtime");
    expect(composeContextLineFromFacts(facts)).toBeNull();
    expect(
      composeContextLineFromFacts(facts, { reachVisibility: "prominent" }),
    ).not.toBeNull();
  });

  it("composeContextLineFromFacts suppresses reach when policy is absent", () => {
    const derived = deriveScanNarrative({
      ...baseResult,
      changedPackages: ["fastify"],
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
      repoIntelligence: fixtureRepoIntelligenceFastify,
    });
    expect(derived.runtimeSurface?.kind).toBe("runtime");
    expect(derived.reachability?.kind).toBe("on_runtime_paths");

    const { reachVisibility: _policy, ...legacyFacts } = derived;
    expect(composeContextLineFromFacts(legacyFacts)).toBeNull();

    expect(
      composeContextLineFromFacts({ ...derived, reachVisibility: null }),
    ).toBeNull();

    expect(
      composeContextLineFromFacts(legacyFacts, {
        reachVisibility: "prominent",
      }),
    ).not.toBeNull();
  });

  it("composeContextLineFromFacts surfaces governed reach for contextual and prominent policy", () => {
    const prominentFacts = deriveScanNarrative({
      ...baseResult,
      changedPackages: ["fastify"],
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
      repoIntelligence: fixtureRepoIntelligenceFastify,
      assessment: {
        ...assessmentFastifyRuntime,
        presentation: {
          ...assessmentFastifyRuntime.presentation,
          reachVisibility: "prominent",
        },
      },
    });
    const contextualFacts = deriveScanNarrative({
      ...baseResult,
      changedPackages: ["fastify"],
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
      repoIntelligence: fixtureRepoIntelligenceFastify,
      assessment: {
        ...assessmentFastifyRuntime,
        presentation: {
          ...assessmentFastifyRuntime.presentation,
          reachVisibility: "contextual",
        },
      },
    });

    const prominentLine = composeContextLineFromFacts(prominentFacts);
    const contextualLine = composeContextLineFromFacts(contextualFacts);
    expect(prominentLine).not.toBeNull();
    expect(contextualLine).not.toBeNull();
    expect(prominentLine).toBe(contextualLine);
  });

  it("composeContextLineFromFacts option overrides transported facts policy", () => {
    const hiddenFacts = deriveScanNarrative({
      ...baseResult,
      changedPackages: ["fastify"],
      analysisPreparation: analysisPreparationWithValidRepoIntel(),
      repoIntelligence: fixtureRepoIntelligenceFastify,
      assessment: {
        ...assessmentFastifyRuntime,
        presentation: {
          ...assessmentFastifyRuntime.presentation,
          reachVisibility: "hidden",
        },
      },
    });
    expect(composeContextLineFromFacts(hiddenFacts)).toBeNull();
    expect(
      composeContextLineFromFacts(hiddenFacts, { reachVisibility: "hidden" }),
    ).toBeNull();
    expect(
      composeContextLineFromFacts(hiddenFacts, {
        reachVisibility: "prominent",
      }),
    ).not.toBeNull();
  });
});
