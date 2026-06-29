import { describe, expect, it } from "vitest";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
import { presentCliScanSummary } from "./presenters/presentCliScanSummary.js";
import { presentDashboardCard } from "./presenters/presentDashboardCard.js";
import { presentGitHubCheckRun } from "./presenters/presentGitHubCheckRun.js";
import { presentGitHubPrComment } from "./presenters/presentGitHubPrComment.js";
import { presentScanDetails } from "./presenters/presentScanDetails.js";
import { projectAssessmentFields } from "./projectAssessmentFields.js";
import {
  scanResultBullmq,
  scanResultEslint,
  scanResultFastifyRuntime,
  scanResultMixedTypescriptFastify,
  scanResultPrettier,
  scanResultTypescriptPatch,
  scanResultVitest,
} from "./fixtures/presentationPersonaFixtures.js";

const SCAN_ID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://app.example.com";

const validationPersonas = [
  { name: "mixed-ts-fastify", result: scanResultMixedTypescriptFastify },
  { name: "fastify-runtime", result: scanResultFastifyRuntime },
  { name: "typescript-patch", result: scanResultTypescriptPatch },
  { name: "prettier", result: scanResultPrettier },
  { name: "bullmq", result: scanResultBullmq },
  { name: "eslint", result: scanResultEslint },
  { name: "vitest", result: scanResultVitest },
];

describe("cliParity guardrail", () => {
  for (const persona of validationPersonas) {
    it(`${persona.name}: CLI shares assessment fields with other surfaces`, () => {
      const bundle = buildScanPresentationBundle({
        result: persona.result,
        pipelineStatus: "done",
      })!;
      const fields = projectAssessmentFields(bundle);
      const cli = presentCliScanSummary(bundle, { repoLabel: "acme/api" });
      const card = presentDashboardCard(bundle);
      const details = presentScanDetails(bundle, { scanId: SCAN_ID });
      const check = presentGitHubCheckRun(bundle, {
        scanId: SCAN_ID,
        webAppOrigin: ORIGIN,
      });
      const comment = presentGitHubPrComment(bundle);

      expect(cli.posture).toBe(fields.posture);
      expect(cli.reasoning).toEqual(fields.reasoning);
      expect(cli.verificationChannel).toBe(fields.verificationChannel);
      expect(cli.verificationFocus).toEqual(fields.verificationFocus);
      expect(cli.confidenceRationale).toBe(fields.confidenceRationale);
      expect(cli.electionSummary).toBe(fields.electionSummary);

      expect(cli.reasoning).toEqual(card.reasoning);
      expect(cli.reasoning).toEqual(details.reasoning);
      expect(cli.reasoning).toEqual(check.reasoning);
      expect(cli.reasoning).toEqual(comment.reasoning);
    });
  }
});
