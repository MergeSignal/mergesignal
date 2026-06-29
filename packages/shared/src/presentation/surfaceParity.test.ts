import { describe, expect, it } from "vitest";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
import { presentDashboardCard } from "./presenters/presentDashboardCard.js";
import { presentScanDetails } from "./presenters/presentScanDetails.js";
import { presentGitHubCheckRun } from "./presenters/presentGitHubCheckRun.js";
import { presentGitHubPrComment } from "./presenters/presentGitHubPrComment.js";
import { renderGitHubCheckRunMarkdown } from "./render/renderGitHubCheckRunMarkdown.js";
import { renderGitHubPrCommentMarkdown } from "./render/renderGitHubPrCommentMarkdown.js";
import {
  scanResultBullmq,
  scanResultEslint,
  scanResultFastifyRuntime,
  scanResultMixedTypescriptFastify,
  scanResultPrettier,
  scanResultTypescriptPatch,
  scanResultVitest,
} from "./fixtures/presentationPersonaFixtures.js";
import type { ScanResult } from "../types.js";
import { projectAssessmentFields } from "./projectAssessmentFields.js";

import { buildNarrativeChannels } from "./compose/narrativeChannels.js";

const SCAN_ID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://app.example.com";

const validationPersonasCore: Array<{
  id: string;
  name: string;
  result: ScanResult;
}> = [
  {
    id: "validation-pr-26",
    name: "PR #26 mixed",
    result: scanResultMixedTypescriptFastify,
  },
  {
    id: "validation-pr-27",
    name: "PR #27 fastify",
    result: scanResultFastifyRuntime,
  },
  {
    id: "validation-pr-28",
    name: "PR #28 typescript",
    result: scanResultTypescriptPatch,
  },
  {
    id: "validation-pr-29",
    name: "PR #29 prettier",
    result: scanResultPrettier,
  },
  { id: "validation-pr-30", name: "PR #30 bullmq", result: scanResultBullmq },
];

const validationPersonas: Array<{ name: string; result: ScanResult }> = [
  ...validationPersonasCore,
  { name: "eslint", result: scanResultEslint },
  { name: "vitest", result: scanResultVitest },
];

function surfacesFor(result: ScanResult) {
  const bundle = buildScanPresentationBundle({
    result,
    pipelineStatus: "done",
  })!;
  const fields = projectAssessmentFields(bundle);
  const card = presentDashboardCard(bundle);
  const details = presentScanDetails(bundle, { scanId: SCAN_ID });
  const check = presentGitHubCheckRun(bundle, {
    scanId: SCAN_ID,
    webAppOrigin: ORIGIN,
  });
  const comment = presentGitHubPrComment(bundle);
  const checkMd = renderGitHubCheckRunMarkdown(check);
  const commentMd = renderGitHubPrCommentMarkdown(comment);
  return { bundle, fields, card, details, check, comment, checkMd, commentMd };
}

describe("surfaceParity guardrail", () => {
  for (const persona of validationPersonas) {
    it(`${persona.name}: posture and assessment fields match across surfaces`, () => {
      const s = surfacesFor(persona.result);

      expect(s.card.posture).toBe(s.fields.posture);
      expect(s.details.posture).toBe(s.fields.posture);
      expect(s.check.posture).toBe(s.fields.posture);
      expect(s.comment.posture).toBe(s.fields.posture);
      expect(s.card.verdict?.posture).toBe(s.fields.posture);

      expect(s.card.primaryConcern).toBe(s.fields.primaryConcern);
      expect(s.details.primaryConcern).toBe(s.fields.primaryConcern);
      expect(s.check.primaryConcern).toBe(s.fields.primaryConcern);
      expect(s.comment.primaryConcern).toBe(s.fields.primaryConcern);

      expect(s.card.narrativeIntensity).toBe(s.fields.narrativeIntensity);
      expect(s.details.narrativeIntensity).toBe(s.fields.narrativeIntensity);
      expect(s.check.narrativeIntensity).toBe(s.fields.narrativeIntensity);
      expect(s.comment.narrativeIntensity).toBe(s.fields.narrativeIntensity);

      expect(s.card.reachVisibility).toBe(s.fields.reachVisibility);
      expect(s.details.reachVisibility).toBe(s.fields.reachVisibility);
      expect(s.check.reachVisibility).toBe(s.fields.reachVisibility);
      expect(s.comment.reachVisibility).toBe(s.fields.reachVisibility);

      expect(s.card.reasoning).toEqual(s.fields.reasoning);
      expect(s.details.reasoning).toEqual(s.fields.reasoning);
      expect(s.check.reasoning).toEqual(s.fields.reasoning);
      expect(s.comment.reasoning).toEqual(s.fields.reasoning);

      expect(s.card.verificationFocus).toEqual(s.fields.verificationFocus);
      expect(s.details.verificationFocus).toEqual(s.fields.verificationFocus);
      expect(s.check.verificationFocus).toEqual(s.fields.verificationFocus);
      expect(s.comment.verificationFocus).toEqual(s.fields.verificationFocus);

      expect(s.card.verificationChannel).toBe(s.fields.verificationChannel);
      expect(s.details.verificationChannel).toBe(s.fields.verificationChannel);
      expect(s.check.verificationChannel).toBe(s.fields.verificationChannel);
      expect(s.comment.verificationChannel).toBe(s.fields.verificationChannel);

      expect(s.card.confidenceRationale).toBe(s.fields.confidenceRationale);
      expect(s.details.confidenceRationale).toBe(s.fields.confidenceRationale);
      expect(s.check.confidenceRationale).toBe(s.fields.confidenceRationale);
      expect(s.comment.confidenceRationale).toBe(s.fields.confidenceRationale);

      expect(s.card.electionSummary).toBe(s.fields.electionSummary);
      expect(s.details.electionSummary).toBe(s.fields.electionSummary);
      expect(s.check.electionSummary).toBe(s.fields.electionSummary);
      expect(s.comment.electionSummary).toBe(s.fields.electionSummary);
    });

    it(`${persona.name}: headline matches across card and details`, () => {
      const s = surfacesFor(persona.result);
      expect(s.details.hero.headline).toBe(s.card.headline);
    });
  }

  it("validation personas #26–#30: pairwise distinct reviewFocalPoint and headlines", () => {
    const focalPoints: unknown[] = [];
    const headlines: string[] = [];

    for (const persona of validationPersonasCore) {
      const s = surfacesFor(persona.result);
      focalPoints.push(persona.result.assessment!.reviewFocalPoint);
      headlines.push(s.card.headline);
      expect(s.check.title).toBe(s.card.headline);
    }

    for (let i = 0; i < headlines.length; i++) {
      for (let j = i + 1; j < headlines.length; j++) {
        expect(headlines[i]).not.toBe(headlines[j]);
      }
    }

    for (let i = 0; i < focalPoints.length; i++) {
      for (let j = i + 1; j < focalPoints.length; j++) {
        expect(focalPoints[i]).not.toEqual(focalPoints[j]);
      }
    }
  });

  it("PR #26: headline uses focal fastify, not changedPackages[0] typescript", () => {
    const result = scanResultMixedTypescriptFastify;
    expect(result.changedPackages?.[0]).toBe("typescript");
    const s = surfacesFor(result);
    expect(s.card.headline.toLowerCase()).toContain("fastify");
    expect(s.card.headline.toLowerCase()).not.toContain("typescript");
  });

  it("validation personas #28–#30: reach and verification channels differ by scope", () => {
    const channelsById = new Map(
      validationPersonasCore.map((p) => {
        const bundle = buildScanPresentationBundle({
          result: p.result,
          pipelineStatus: "done",
        })!;
        return [p.id, buildNarrativeChannels(bundle)] as const;
      }),
    );

    const ch28 = channelsById.get("validation-pr-28")!;
    const ch29 = channelsById.get("validation-pr-29")!;
    const ch27 = channelsById.get("validation-pr-27")!;
    const ch30 = channelsById.get("validation-pr-30")!;
    const ch26 = channelsById.get("validation-pr-26")!;

    expect(ch28.reachLabel).toBeUndefined();
    expect(ch29.reachLabel).toBeUndefined();
    expect(ch28.verification.length).toBeGreaterThan(0);
    expect(ch29.verification.length).toBeGreaterThan(0);
    expect(ch27.verification.length).toBeGreaterThan(0);
    expect(ch30.verification.length).toBeGreaterThan(0);
    expect(ch27.verification).not.toEqual(ch30.verification);
    expect(ch26.verification).not.toEqual(ch27.verification);
    expect(ch26.scopeAreas.length).toBeGreaterThan(0);
  });
});
