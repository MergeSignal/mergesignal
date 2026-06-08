import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildScanCardPresentation } from "../orchestration/buildScanCardPresentation.js";
import {
  scanResultFastifyRuntime,
  scanResultTypescriptPatch,
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

describe("dashboardCardGolden fixtures", () => {
  it("matches live typescript patch card", () => {
    const live = buildScanCardPresentation({
      result: scanResultTypescriptPatch,
      pipelineStatus: "done",
    });
    expect(live).toEqual(golden.typescriptPatch);
  });

  it("matches live fastify runtime card", () => {
    const live = buildScanCardPresentation({
      result: scanResultFastifyRuntime,
      pipelineStatus: "done",
    });
    expect(live).toEqual(golden.fastifyRuntime);
  });

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
