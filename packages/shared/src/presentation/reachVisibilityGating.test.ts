import { describe, expect, it } from "vitest";
import { deriveScanNarrative } from "../deriveScanNarrative.js";
import { scanSurfaceCopy } from "../scanSurfaceCopy.js";
import type {
  ReachVisibility,
  VerificationIntensity,
} from "../assessment/types.js";
import type { ScanResult } from "../types.js";
import { scanResultFastifyRuntime } from "./fixtures/scanResultFixtures.js";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
import {
  buildNarrativeChannels,
  projectCompactKeyPoints,
} from "./compose/narrativeChannels.js";
import { presentCliScanSummary } from "./presenters/presentCliScanSummary.js";
import { presentDashboardCard } from "./presenters/presentDashboardCard.js";
import { presentGitHubCheckRun } from "./presenters/presentGitHubCheckRun.js";
import { presentScanDetails } from "./presenters/presentScanDetails.js";
import { projectAssessmentFields } from "./projectAssessmentFields.js";
import { shouldSurfaceReachNarrative } from "./reachNarrativeGating.js";

const SCAN_ID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://app.example.com";

function withReachVisibility(
  reachVisibility: ReachVisibility,
  verificationIntensity?: VerificationIntensity,
): ScanResult {
  const assessment = scanResultFastifyRuntime.assessment!;
  return {
    ...scanResultFastifyRuntime,
    assessment: {
      ...assessment,
      presentation: {
        ...assessment.presentation,
        reachVisibility,
        ...(verificationIntensity !== undefined
          ? { verificationIntensity }
          : {}),
      },
    },
  };
}

function hiddenReachNoReasoningResult(): ScanResult {
  const assessment = scanResultFastifyRuntime.assessment!;
  return {
    ...scanResultFastifyRuntime,
    decision: undefined,
    assessment: {
      ...assessment,
      reasoning: [],
      primaryConcern: null,
      concerns: [],
      factors: [],
      presentation: {
        ...assessment.presentation,
        reachVisibility: "hidden",
        verificationIntensity: "none",
      },
    },
  };
}

function bundleFor(result: ScanResult) {
  return buildScanPresentationBundle({ result, pipelineStatus: "done" })!;
}

describe("reachVisibility presentation gating", () => {
  describe("hidden reach", () => {
    const hiddenResult = withReachVisibility("hidden", "required");
    const hiddenBundle = bundleFor(hiddenResult);

    it("preserves truthful canonical narrative facts in deriveScanNarrative", () => {
      const facts = deriveScanNarrative(hiddenResult);
      expect(facts.runtimeSurface?.kind).toBe("runtime");
      expect(facts.reachability?.kind).toBe("on_runtime_paths");
      expect(facts.packageUsage.length).toBeGreaterThan(0);
      expect(facts.packageUsage[0]?.paths.length).toBeGreaterThan(0);
    });

    it("suppresses reach-derived narrative channels", () => {
      const channels = buildNarrativeChannels(hiddenBundle);
      expect(channels.reachLabel).toBeUndefined();
      expect(channels.scopeAreas).toEqual([]);
      expect(channels.evidence).toEqual([]);
      expect(channels.insights.length).toBeGreaterThan(0);
    });

    it("suppresses reach-derived compact key points while keeping Assessment reasoning", () => {
      const channels = buildNarrativeChannels(hiddenBundle);
      const compact = projectCompactKeyPoints(channels, 6);
      expect(compact.some((p) => /Affected areas:/i.test(p))).toBe(false);
      expect(compact.some((p) => /Blast radius/i.test(p))).toBe(false);
      expect(compact.some((p) => /apps\/api\/src/i.test(p))).toBe(false);
      expect(compact.length).toBeGreaterThan(0);
    });

    it("suppresses usage/path scan-details presentation", () => {
      const details = presentScanDetails(hiddenBundle, { scanId: SCAN_ID });
      expect(details.usage).toBeUndefined();
      expect(details.hero.scopeChip).toBeUndefined();
      expect(details.hero.headline.length).toBeGreaterThan(0);
      expect(details.reasoning.length).toBeGreaterThan(0);
    });

    it("CLI inherits hidden-reach gating without independent leakage", () => {
      const cli = presentCliScanSummary(hiddenBundle);
      const compactText = cli.keyPoints.join(" ");
      expect(compactText).not.toMatch(/Affected areas:/i);
      expect(compactText).not.toMatch(/Blast radius/i);
      expect(cli.headline.length).toBeGreaterThan(0);
      expect(cli.reasoning.length).toBeGreaterThan(0);
    });

    it("GitHub check run keeps Assessment-authored reasoning without reach leakage", () => {
      const check = presentGitHubCheckRun(hiddenBundle, {
        scanId: SCAN_ID,
        webAppOrigin: ORIGIN,
      });
      const why = check.sections.find((s) => s.title === "Why");
      expect(why?.bullets.length).toBeGreaterThan(0);
      const whyText = (why?.bullets ?? []).join(" ");
      expect(whyText).not.toMatch(/Affected areas:/i);
      expect(whyText).not.toMatch(/Blast radius/i);
      expect(check.reasoning.length).toBeGreaterThan(0);
      expect(check.reasoning).toEqual(hiddenBundle.result.decision?.reasoning);
    });

    it("CLI compact key points do not leak reach when Assessment reasoning is empty", () => {
      const bundle = bundleFor(hiddenReachNoReasoningResult());
      const cli = presentCliScanSummary(bundle);
      expect(cli.reasoning).toEqual([]);
      expect(cli.keyPoints).toEqual([]);
    });

    it("GitHub check run compact fallback does not leak reach when reasoning is empty", () => {
      const bundle = bundleFor(hiddenReachNoReasoningResult());
      const check = presentGitHubCheckRun(bundle, {
        scanId: SCAN_ID,
        webAppOrigin: ORIGIN,
      });
      expect(check.reasoning).toEqual([]);
      const why = check.sections.find((s) => s.title === "Why");
      expect(why).toBeUndefined();
    });

    it("dashboard card aligns with hidden-reach policy", () => {
      const card = presentDashboardCard(hiddenBundle);
      expect(card.verdict?.scopeLabel).toBeUndefined();
      expect(card.scopeAreas).toBeUndefined();
      expect(card.evidenceChips).toBeUndefined();
      expect(card.insights.length).toBeGreaterThan(0);
    });

    it("does not mutate canonical engine output during presentation projection", () => {
      const result = structuredClone(hiddenResult);
      const snapshot = {
        repoIntelligence: structuredClone(result.repoIntelligence),
        assessment: structuredClone(result.assessment),
        facts: structuredClone(deriveScanNarrative(result)),
      };

      const bundle = bundleFor(result);
      presentDashboardCard(bundle);
      presentScanDetails(bundle, { scanId: SCAN_ID });
      presentCliScanSummary(bundle);
      presentGitHubCheckRun(bundle, {
        scanId: SCAN_ID,
        webAppOrigin: ORIGIN,
      });

      expect(result.repoIntelligence).toEqual(snapshot.repoIntelligence);
      expect(result.assessment).toEqual(snapshot.assessment);
      expect(deriveScanNarrative(result)).toEqual(snapshot.facts);
      expect(bundle.facts).toEqual(snapshot.facts);
    });
  });

  describe("prominent reach", () => {
    const prominentResult = withReachVisibility("prominent", "required");
    const prominentBundle = bundleFor(prominentResult);

    it("surfaces governed reach/runtime presentation", () => {
      const channels = buildNarrativeChannels(prominentBundle);
      expect(channels.reachLabel).toBe(
        scanSurfaceCopy.scanDetail.reachChip.moderate,
      );
      expect(channels.scopeAreas.length).toBeGreaterThan(0);

      const compact = projectCompactKeyPoints(channels, 6);
      expect(compact.some((p) => /Affected areas:/i.test(p))).toBe(true);

      const details = presentScanDetails(prominentBundle, { scanId: SCAN_ID });
      expect(details.usage?.items.length).toBeGreaterThan(0);
      expect(details.usage?.items[0]?.paths.length).toBeGreaterThan(0);
      expect(details.hero.scopeChip).toBe(channels.reachLabel);
    });
  });

  describe("contextual reach", () => {
    const contextualResult = withReachVisibility("contextual", "required");
    const contextualBundle = bundleFor(contextualResult);

    it("shows contextual reach label and scoped reach evidence", () => {
      const channels = buildNarrativeChannels(contextualBundle);
      expect(channels.reachLabel).toBe(
        scanSurfaceCopy.scanDetail.reachChip.limited,
      );
      expect(channels.scopeAreas.length).toBeGreaterThan(0);
      expect(channels.reachLabel).not.toBe(
        scanSurfaceCopy.scanDetail.reachChip.moderate,
      );

      const details = presentScanDetails(contextualBundle, { scanId: SCAN_ID });
      expect(details.usage?.items.length).toBeGreaterThan(0);
    });

    it("honors package-level suppressRuntimeNarrative under contextual reach", () => {
      const suppressedResult: ScanResult = {
        ...contextualResult,
        repoIntelligence: {
          ...contextualResult.repoIntelligence!,
          packages: {
            ...contextualResult.repoIntelligence!.packages,
            fastify: {
              ...contextualResult.repoIntelligence!.packages!.fastify!,
              suppressRuntimeNarrative: true,
            },
          },
        },
      };
      const bundle = bundleFor(suppressedResult);
      expect(
        shouldSurfaceReachNarrative(bundle.presentation, {
          suppressRuntimeNarrative: true,
        }),
      ).toBe(false);

      const details = presentScanDetails(bundle, { scanId: SCAN_ID });
      expect(details.usage).toBeUndefined();
    });
  });

  describe("verificationFocus presentation", () => {
    it("selects verification guidance without mutating canonical verification facts", () => {
      const noneResult = withReachVisibility("hidden", "none");
      const noneBundle = bundleFor(noneResult);
      const noneFields = projectAssessmentFields(noneBundle);
      expect(noneFields.verificationFocus).toEqual([]);
      expect(noneFields.verificationChannel).toBe("none");

      const requiredResult = withReachVisibility("hidden", "required");
      const requiredBundle = bundleFor(requiredResult);
      const requiredFields = projectAssessmentFields(requiredBundle);
      expect(requiredFields.verificationChannel).toBe("runtime");
      expect(requiredFields.verificationFocus.length).toBeGreaterThan(0);
      expect(
        requiredBundle.assessment.verificationScope?.focus?.length,
      ).toBeGreaterThan(0);

      const factsAfter = deriveScanNarrative(requiredResult);
      expect(factsAfter.packageUsage.length).toBeGreaterThan(0);
    });

    it("keeps advisory verification behavior for artifact channel", () => {
      const advisoryResult = withReachVisibility("hidden", "advisory");
      const advisoryBundle = bundleFor(advisoryResult);
      const fields = projectAssessmentFields(advisoryBundle);
      expect(fields.verificationChannel).toBe("artifact");
    });
  });

  describe("consumer consistency for hidden reach", () => {
    it("all governed surfaces honor the same reachVisibility policy", () => {
      const bundle = bundleFor(withReachVisibility("hidden", "required"));
      const card = presentDashboardCard(bundle);
      const details = presentScanDetails(bundle, { scanId: SCAN_ID });
      const cli = presentCliScanSummary(bundle);
      const check = presentGitHubCheckRun(bundle, {
        scanId: SCAN_ID,
        webAppOrigin: ORIGIN,
      });

      expect(card.reachVisibility).toBe("hidden");
      expect(details.reachVisibility).toBe("hidden");
      expect(cli.reachVisibility).toBe("hidden");
      expect(check.reachVisibility).toBe("hidden");

      expect(card.verdict?.scopeLabel).toBeUndefined();
      expect(details.hero.scopeChip).toBeUndefined();
      expect(details.usage).toBeUndefined();
      expect(cli.keyPoints.join(" ")).not.toMatch(/Affected areas:/i);
    });
  });
});
