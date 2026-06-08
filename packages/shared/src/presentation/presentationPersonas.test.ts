import { describe, expect, it } from "vitest";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
import { presentDashboardCard } from "./presenters/presentDashboardCard.js";
import { presentScanDetails } from "./presenters/presentScanDetails.js";
import { presentCliScanSummary } from "./presenters/presentCliScanSummary.js";
import type { PresentationIntent } from "./intent/presentationIntent.js";
import type { ScanResult } from "../types.js";
import {
  scanResultBullmq,
  scanResultEslint,
  scanResultFastifyRuntime,
  scanResultLimitedContext,
  scanResultMixedTypescriptFastify,
  scanResultNextAuth,
  scanResultPrettier,
  scanResultTypescriptPatch,
  scanResultUnknownSafe,
  scanResultVitest,
} from "./fixtures/presentationPersonaFixtures.js";

const SCAN_ID = "22222222-2222-4222-8222-222222222222";

type PersonaExpectation = {
  name: string;
  result: ScanResult;
  intent: PresentationIntent;
  status: "safe" | "needs_review" | "risky";
  density: "minimal" | "standard" | "rich";
  headlineMatch: RegExp;
  headlineMustNot?: RegExp;
  verificationIncludes?: string[];
  verificationMustNot?: RegExp;
};

const SAFE_FORBIDDEN = /needs review|high risk|critical concern/i;
const REVIEW_FORBIDDEN = /no action required|no verification required/i;

const personas: PersonaExpectation[] = [
  {
    name: "typescript patch",
    result: scanResultTypescriptPatch,
    intent: "tooling_patch",
    status: "safe",
    density: "minimal",
    headlineMatch: /patch upgrade/i,
    headlineMustNot: /needs review/i,
    verificationIncludes: ["CI", "typecheck"],
    verificationMustNot: /auth flow/i,
  },
  {
    name: "eslint",
    result: scanResultEslint,
    intent: "tooling_upgrade",
    status: "safe",
    density: "minimal",
    headlineMatch: /tooling upgrade/i,
    headlineMustNot: /needs review/i,
    verificationIncludes: ["CI", "lint"],
  },
  {
    name: "prettier",
    result: scanResultPrettier,
    intent: "tooling_upgrade",
    status: "safe",
    density: "minimal",
    headlineMatch: /tooling upgrade/i,
    headlineMustNot: /needs review/i,
    verificationIncludes: ["format"],
  },
  {
    name: "vitest",
    result: scanResultVitest,
    intent: "tooling_upgrade",
    status: "safe",
    density: "minimal",
    headlineMatch: /tooling upgrade/i,
    headlineMustNot: /needs review/i,
    verificationIncludes: ["test suite"],
  },
  {
    name: "fastify runtime",
    result: scanResultFastifyRuntime,
    intent: "runtime_upgrade",
    status: "needs_review",
    density: "rich",
    headlineMatch: /runtime upgrade affects/i,
    verificationIncludes: ["routes", "middleware"],
  },
  {
    name: "nextauth runtime",
    result: scanResultNextAuth,
    intent: "auth_runtime_upgrade",
    status: "needs_review",
    density: "rich",
    headlineMatch: /runtime upgrade affects/i,
    verificationIncludes: ["auth flow"],
  },
  {
    name: "bullmq runtime",
    result: scanResultBullmq,
    intent: "queue_runtime_upgrade",
    status: "needs_review",
    density: "rich",
    headlineMatch: /runtime upgrade affects/i,
    verificationIncludes: ["workers", "queue"],
  },
  {
    name: "limited context",
    result: scanResultLimitedContext,
    intent: "limited_context",
    status: "needs_review",
    density: "minimal",
    headlineMatch: /limited scan context/i,
  },
  {
    name: "unknown safe",
    result: scanResultUnknownSafe,
    intent: "unknown_upgrade",
    status: "safe",
    density: "standard",
    headlineMatch: /dependency upgrade/i,
    headlineMustNot: /needs review/i,
  },
];

function cardFor(result: ScanResult) {
  const bundle = buildScanPresentationBundle({
    result,
    pipelineStatus: "done",
  })!;
  return presentDashboardCard(bundle);
}

describe("presentation personas", () => {
  for (const persona of personas) {
    it(`${persona.name}: intent, posture alignment, headline`, () => {
      const card = cardFor(persona.result);
      expect(card.verdict?.posture).toBe(persona.status);
      if (persona.density === "rich") {
        expect(card.layout).toBe("expanded");
      }
      expect(card.headline).toMatch(persona.headlineMatch);
      if (persona.headlineMustNot) {
        expect(card.headline).not.toMatch(persona.headlineMustNot);
      }
      if (persona.status === "safe") {
        const combined = [
          card.headline,
          ...card.insights,
          ...card.verification,
        ].join(" ");
        expect(combined).not.toMatch(SAFE_FORBIDDEN);
      }
      if (persona.status === "needs_review") {
        const combined = card.verification.join(" ");
        expect(combined).not.toMatch(REVIEW_FORBIDDEN);
      }
      if (persona.verificationIncludes) {
        for (const v of persona.verificationIncludes) {
          expect(
            card.verification.some((a) =>
              a.toLowerCase().includes(v.toLowerCase()),
            ),
          ).toBe(true);
        }
      }
      if (persona.verificationMustNot) {
        expect(card.verification.join(" ")).not.toMatch(
          persona.verificationMustNot,
        );
      }
    });
  }

  it("mixed typescript+fastify: runtime intent, fastify in headline", () => {
    const card = cardFor(scanResultMixedTypescriptFastify);
    expect(card.verdict?.posture).toBe("needs_review");
    expect(card.headline.toLowerCase()).toContain("fastify");
    expect(card.headline).not.toMatch(/patch upgrade/i);
  });

  it("cross-surface parity: fastify headline matches card, details, CLI", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultFastifyRuntime,
      pipelineStatus: "done",
    })!;
    const card = presentDashboardCard(bundle);
    const details = presentScanDetails(bundle, { scanId: SCAN_ID });
    const cli = presentCliScanSummary(bundle, { repoLabel: "acme/api" });
    expect(details.hero.headline).toBe(card.headline);
    expect(cli.headline).toBe(card.headline);
  });

  it("cross-surface parity: typescript headline matches card, details, CLI", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultTypescriptPatch,
      pipelineStatus: "done",
    })!;
    const card = presentDashboardCard(bundle);
    const details = presentScanDetails(bundle, { scanId: SCAN_ID });
    const cli = presentCliScanSummary(bundle, { repoLabel: "acme/api" });
    expect(details.hero.headline).toBe(card.headline);
    expect(cli.headline).toBe(card.headline);
    expect(card.headline).not.toMatch(/needs review/i);
  });
});
