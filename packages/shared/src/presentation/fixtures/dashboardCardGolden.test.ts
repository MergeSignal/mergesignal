import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildScanCardPresentation } from "../orchestration/buildScanCardPresentation.js";
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
} from "./presentationPersonaFixtures.js";
import type { DashboardCardPresentation } from "../dto/dashboardCardPresentation.js";

const goldenPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "dashboardCardGolden.json",
);
const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as Record<
  string,
  DashboardCardPresentation
>;

const personaCases: Array<{
  key: string;
  result: Parameters<typeof buildScanCardPresentation>[0]["result"];
}> = [
  { key: "typescriptPatch", result: scanResultTypescriptPatch },
  { key: "eslint", result: scanResultEslint },
  { key: "prettier", result: scanResultPrettier },
  { key: "vitest", result: scanResultVitest },
  { key: "fastifyRuntime", result: scanResultFastifyRuntime },
  { key: "nextAuth", result: scanResultNextAuth },
  { key: "bullmq", result: scanResultBullmq },
  { key: "limitedContext", result: scanResultLimitedContext },
  { key: "unknownSafe", result: scanResultUnknownSafe },
  { key: "mixedTypescriptFastify", result: scanResultMixedTypescriptFastify },
];

describe("dashboardCardGolden fixtures", () => {
  for (const { key, result } of personaCases) {
    it(`matches live ${key} card`, () => {
      const live = buildScanCardPresentation({
        result,
        pipelineStatus: "done",
      });
      expect(live).toEqual(golden[key]);
    });
  }

  it("fastify golden has deduplicated channels", () => {
    const card = golden.fastifyRuntime;
    const insightText = card.insights.join(" ");
    expect(insightText).not.toMatch(/Affected areas:/i);
    expect(card.scopeAreas?.length).toBeGreaterThan(0);
    expect(card.evidenceChips?.some((e) => e.label === "Blast radius")).toBe(
      true,
    );
  });
});
