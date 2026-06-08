import { describe, expect, it } from "vitest";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
import { presentDashboardCard } from "./presenters/presentDashboardCard.js";
import { presentScanDetails } from "./presenters/presentScanDetails.js";
import { presentGitHubCheckRun } from "./presenters/presentGitHubCheckRun.js";
import { presentGitHubPrComment } from "./presenters/presentGitHubPrComment.js";
import { presentCliScanSummary } from "./presenters/presentCliScanSummary.js";
import {
  scanResultFastifyRuntime,
  scanResultLimitedContext,
  scanResultTypescriptPatch,
} from "./fixtures/scanResultFixtures.js";

const SCAN_ID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://app.example.com";

describe("buildScanPresentationBundle", () => {
  it("returns null for incomplete pipeline", () => {
    expect(
      buildScanPresentationBundle({
        result: scanResultFastifyRuntime,
        pipelineStatus: "running",
      }),
    ).toBeNull();
  });

  it("fastify persona: rich needs_review pr_intelligence", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultFastifyRuntime,
      pipelineStatus: "done",
    })!;
    expect(bundle.profile.density).toBe("rich");
    expect(bundle.profile.status).toBe("needs_review");
    expect(bundle.profile.priority).toBe("pr_intelligence");
  });

  it("typescript persona: minimal safe pr_intelligence", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultTypescriptPatch,
      pipelineStatus: "done",
    })!;
    expect(bundle.profile.density).toBe("minimal");
    expect(bundle.profile.status).toBe("safe");
    expect(bundle.profile.priority).toBe("pr_intelligence");
  });

  it("limited context persona: minimal limited priority", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultLimitedContext,
      pipelineStatus: "done",
    })!;
    expect(bundle.profile.density).toBe("minimal");
    expect(bundle.profile.priority).toBe("limited");
    expect(bundle.profile.degradedMessage).toBeTruthy();
  });
});

describe("presentDashboardCard personas", () => {
  it("fastify card has scope areas and verification", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultFastifyRuntime,
      pipelineStatus: "done",
    })!;
    const card = presentDashboardCard(bundle);
    expect(card.layout).toBe("expanded");
    expect(card.scopeAreas!.length).toBeGreaterThan(0);
    expect(card.verification.length).toBeGreaterThan(0);
    expect(card.headline.toLowerCase()).toContain("fastify");
    expect(card.verdict?.posture).toBe("needs_review");
  });

  it("typescript card is quiet safe", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultTypescriptPatch,
      pipelineStatus: "done",
    })!;
    const card = presentDashboardCard(bundle);
    expect(["quiet", "standard"]).toContain(card.layout);
    expect(card.verdict?.posture).toBe("safe");
    expect(card.headline).toMatch(/patch upgrade/i);
    expect(card.headline).not.toMatch(/needs review/i);
    expect(card.verification.length).toBeGreaterThan(0);
  });
});

describe("presentation parity across surfaces", () => {
  it("same bundle drives card, details, GitHub, CLI with identical profile", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultFastifyRuntime,
      pipelineStatus: "done",
    })!;

    const card = presentDashboardCard(bundle);
    const details = presentScanDetails(bundle, { scanId: SCAN_ID });
    const check = presentGitHubCheckRun(bundle, {
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
    });
    const comment = presentGitHubPrComment(bundle);
    const cli = presentCliScanSummary(bundle, { repoLabel: "acme/api" });

    for (const dto of [details, check, comment, cli]) {
      expect(dto.status).toBe(bundle.profile.status);
      expect(dto.density).toBe(bundle.profile.density);
      expect(dto.confidence).toBe(bundle.profile.confidence);
      expect(dto.evidenceContext?.priority).toBe(bundle.profile.priority);
    }

    expect(card.verdict?.posture).toBe(bundle.profile.status);
    expect(details.narrative.primaryPackage).toBe("fastify");
    expect(check.title.toLowerCase()).toContain("fastify");
  });
});
