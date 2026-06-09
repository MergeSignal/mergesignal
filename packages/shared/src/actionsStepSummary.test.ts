import { describe, expect, it } from "vitest";
import { assessmentFastifyRuntime } from "./fixtures/assessmentFixtures.js";
import { buildActionsStepSummaryMarkdown } from "./actionsStepSummary.js";
import { scanSurfaceCopyFlat } from "./scanSurfaceCopy.js";
import type { ScanResult } from "./types.js";

const copy = scanSurfaceCopyFlat();

const sampleResult: ScanResult = {
  totalScore: 55,
  layerScores: {
    security: 10,
    maintainability: 20,
    ecosystem: 30,
    upgradeImpact: 15,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
  changedPackages: ["fastify"],
  assessment: assessmentFastifyRuntime,
  decision: {
    recommendation: "needs_review",
    confidence: "medium",
    reasoning: [
      "Changed package has confirmed usage on runtime application paths in this repository.",
    ],
  },
};

describe("buildActionsStepSummaryMarkdown", () => {
  it("renders development profile with demo header", () => {
    const md = buildActionsStepSummaryMarkdown({
      result: sampleResult,
      profile: "development",
      copy,
    });
    expect(md).toContain("#");
    expect(md.toLowerCase()).toContain("fastify");
  });

  it("renders trusted profile without demo header", () => {
    const md = buildActionsStepSummaryMarkdown({
      result: sampleResult,
      profile: "trusted",
      copy,
    });
    expect(md).not.toContain(copy["actions.demoSummaryBanner"] ?? "");
    expect(md).toContain("MergeSignal");
  });

  it("returns failure message when assessment is missing", () => {
    const md = buildActionsStepSummaryMarkdown({
      result: { ...sampleResult, assessment: undefined },
      profile: "trusted",
      copy,
    });
    expect(md).toContain("could not be completed");
  });
});
