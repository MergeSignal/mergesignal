import { describe, expect, it } from "vitest";

import { assessmentTypescriptPatch } from "../../fixtures/assessmentFixtures.js";
import { buildProfileFromAssessment } from "./buildProfileFromAssessment.js";
import type { ScanResult } from "../../types.js";
import type { AssessmentPresentationPublic } from "../../assessment/types.js";

const presentation: AssessmentPresentationPublic = {
  narrativeIntensity: "minimal",
  reachVisibility: "hidden",
  verificationVisibility: "hidden",
};

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
  changedPackages: [] as string[],
} satisfies ScanResult;

describe("buildProfileFromAssessment lockfile evidence presentation", () => {
  it("verified no-transition Safe with informational code_fetch_skipped stays non-degraded", () => {
    const profile = buildProfileFromAssessment(
      {
        ...assessmentTypescriptPatch,
        posture: "safe",
        outcome: "cleared",
      },
      presentation,
      {
        ...baseResult,
        analysisPreparation: {
          codeIntelligenceAvailable: false,
          warnings: [{ code: "code_fetch_skipped", message: "fetch skipped" }],
        },
      },
    );

    expect(profile.degradedMessage).toBeUndefined();
  });

  it("shows limited context for incomplete lockfile evidence uncertainty", () => {
    const profile = buildProfileFromAssessment(
      {
        ...assessmentTypescriptPatch,
        posture: "safe",
        outcome: "cleared",
      },
      presentation,
      {
        ...baseResult,
        changedPackages: ["lodash"],
        analysisPreparation: {
          codeIntelligenceAvailable: true,
          warnings: [
            { code: "lockfile_evidence_incomplete", message: "incomplete" },
          ],
        },
      },
    );

    expect(profile.degradedMessage).toBeTruthy();
  });

  it("treats code fetch failures as preparation uncertainty", () => {
    const profile = buildProfileFromAssessment(
      assessmentTypescriptPatch,
      presentation,
      {
        ...baseResult,
        changedPackages: ["lodash"],
        analysisPreparation: {
          codeIntelligenceAvailable: false,
          warnings: [{ code: "code_fetch_failed", message: "failed" }],
        },
      },
    );

    expect(profile.degradedMessage).toBeTruthy();
  });

  it("does not apply verified-no-transition suppression when changed packages are present", () => {
    const profile = buildProfileFromAssessment(
      {
        ...assessmentTypescriptPatch,
        posture: "safe",
        outcome: "cleared",
      },
      presentation,
      {
        ...baseResult,
        changedPackages: ["lodash"],
        analysisPreparation: {
          codeIntelligenceAvailable: true,
          warnings: [
            { code: "lockfile_evidence_incomplete", message: "incomplete" },
          ],
        },
      },
    );

    expect(profile.degradedMessage).toBeTruthy();
  });

  it("shows limited context for non-cleared outcomes with limited priority", () => {
    const profile = buildProfileFromAssessment(
      {
        ...assessmentTypescriptPatch,
        posture: "needs_review",
        outcome: "bounded_verify",
        confidence: "low",
      },
      presentation,
      {
        ...baseResult,
        changedPackages: [],
        analysisPreparation: {
          codeIntelligenceAvailable: true,
          warnings: [],
        },
      },
    );

    expect(profile.degradedMessage).toBeTruthy();
  });
});
