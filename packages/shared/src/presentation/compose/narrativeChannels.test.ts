import { describe, expect, it } from "vitest";
import { buildScanPresentationBundle } from "../orchestration/buildScanPresentationBundle.js";
import { scanResultFastifyRuntime } from "../fixtures/scanResultFixtures.js";
import {
  buildNarrativeChannels,
  projectCompactKeyPoints,
} from "./narrativeChannels.js";
import { presentDashboardCard } from "../presenters/presentDashboardCard.js";

describe("buildNarrativeChannels", () => {
  it("fastify: areas in scopeAreas only, blast in evidence only, not in insights", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultFastifyRuntime,
      pipelineStatus: "done",
    })!;
    const channels = buildNarrativeChannels(bundle);

    const insightText = channels.insights.join(" ");
    expect(insightText).not.toMatch(/Affected areas:/i);
    expect(insightText).not.toMatch(/Blast radius is/i);
    expect(channels.scopeAreas.length).toBeGreaterThan(0);
    expect(channels.evidence.some((r) => r.label === "Blast radius")).toBe(
      true,
    );
    expect(channels.evidence.some((r) => r.label === "Runtime")).toBe(false);
  });

  it("projectCompactKeyPoints merges channels for single-column surfaces", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultFastifyRuntime,
      pipelineStatus: "done",
    })!;
    const channels = buildNarrativeChannels(bundle);
    const compact = projectCompactKeyPoints(channels, 5);
    expect(compact.some((p) => /Affected areas:/i.test(p))).toBe(true);
    expect(compact.some((p) => /Blast radius is/i.test(p))).toBe(true);
  });

  it("presentDashboardCard does not duplicate areas across insights and scopeAreas", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultFastifyRuntime,
      pipelineStatus: "done",
    })!;
    const card = presentDashboardCard(bundle);
    const insightText = card.insights.join(" ");
    expect(insightText).not.toMatch(/Affected areas:/i);
    expect(card.scopeAreas?.length).toBeGreaterThan(0);
    expect(card.verdict?.scopeLabel).toBeTruthy();
    expect(card.verification.every((v) => v.startsWith("Verify"))).toBe(true);
  });
});
