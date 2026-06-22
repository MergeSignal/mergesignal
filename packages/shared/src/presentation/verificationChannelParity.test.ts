import { describe, expect, it } from "vitest";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
import { presentDashboardCard } from "./presenters/presentDashboardCard.js";
import { presentScanDetails } from "./presenters/presentScanDetails.js";
import { presentGitHubCheckRun } from "./presenters/presentGitHubCheckRun.js";
import { presentGitHubPrComment } from "./presenters/presentGitHubPrComment.js";
import { projectAssessmentFields } from "./projectAssessmentFields.js";
import {
  scanResultFastifyRuntime,
  scanResultPrettier,
  scanResultTypescriptPatch,
} from "./fixtures/presentationPersonaFixtures.js";

const SCAN_ID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://app.example.com";

describe("verification channel provenance parity", () => {
  for (const persona of [
    {
      name: "fastify runtime",
      result: scanResultFastifyRuntime,
      channel: "runtime" as const,
      focusIncludes: "routes",
    },
    {
      name: "typescript patch",
      result: scanResultTypescriptPatch,
      channel: "artifact" as const,
      focusIncludes: "typecheck",
    },
    {
      name: "prettier",
      result: scanResultPrettier,
      channel: "artifact" as const,
      focusIncludes: "format",
    },
  ]) {
    it(`${persona.name}: verificationChannel and focus match across surfaces`, () => {
      const bundle = buildScanPresentationBundle({
        result: persona.result,
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

      expect(fields.verificationChannel).toBe(persona.channel);
      expect(card.verificationChannel).toBe(persona.channel);
      expect(details.verificationChannel).toBe(persona.channel);
      expect(check.verificationChannel).toBe(persona.channel);
      expect(comment.verificationChannel).toBe(persona.channel);

      expect(fields.verificationFocus).toEqual(card.verificationFocus);
      expect(details.verificationFocus).toEqual(fields.verificationFocus);
      expect(check.verificationFocus).toEqual(fields.verificationFocus);
      expect(comment.verificationFocus).toEqual(fields.verificationFocus);

      expect(
        fields.verificationFocus.some((f) =>
          f.toLowerCase().includes(persona.focusIncludes.toLowerCase()),
        ),
      ).toBe(true);
    });
  }
});
