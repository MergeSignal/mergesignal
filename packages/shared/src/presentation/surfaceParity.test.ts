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

const SCAN_ID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://app.example.com";

const validationPersonas: Array<{ name: string; result: ScanResult }> = [
  { name: "PR #26 mixed", result: scanResultMixedTypescriptFastify },
  { name: "PR #27 fastify", result: scanResultFastifyRuntime },
  { name: "PR #28 typescript", result: scanResultTypescriptPatch },
  { name: "PR #29 prettier", result: scanResultPrettier },
  { name: "PR #30 bullmq", result: scanResultBullmq },
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
    });

    it(`${persona.name}: headline matches across card and details`, () => {
      const s = surfacesFor(persona.result);
      expect(s.details.hero.headline).toBe(s.card.headline);
    });
  }
});
