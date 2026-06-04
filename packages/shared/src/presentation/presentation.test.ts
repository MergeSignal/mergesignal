import { describe, expect, it } from "vitest";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
import { presentScanCard } from "./presenters/presentScanCard.js";
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

describe("presentScanCard personas", () => {
  it("fastify card is rich with affected areas and verification", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultFastifyRuntime,
      pipelineStatus: "done",
    })!;
    const card = presentScanCard(bundle);
    expect(card.density).toBe("rich");
    expect(card.affectedAreas.length).toBeGreaterThan(0);
    expect(card.verificationActions.length).toBeGreaterThan(0);
    expect(card.headline.toLowerCase()).toContain("fastify");
    expect(card.supportingContext).toBeUndefined();
  });

  it("typescript card is minimal safe without graph-first story", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultTypescriptPatch,
      pipelineStatus: "done",
    })!;
    const card = presentScanCard(bundle);
    expect(card.density).toBe("minimal");
    expect(card.status).toBe("safe");
    expect(card.changedPackages).toContain("typescript");
    expect(card.verificationActions.length).toBeGreaterThan(0);
  });
});

describe("presentation parity across surfaces", () => {
  it("same bundle drives card, details, GitHub, CLI with identical profile", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultFastifyRuntime,
      pipelineStatus: "done",
    })!;

    const card = presentScanCard(bundle);
    const details = presentScanDetails(bundle, { scanId: SCAN_ID });
    const check = presentGitHubCheckRun(bundle, {
      scanId: SCAN_ID,
      webAppOrigin: ORIGIN,
    });
    const comment = presentGitHubPrComment(bundle);
    const cli = presentCliScanSummary(bundle, { repoLabel: "acme/api" });

    for (const dto of [card, details, check, comment, cli]) {
      expect(dto.status).toBe(bundle.profile.status);
      expect(dto.density).toBe(bundle.profile.density);
      expect(dto.confidence).toBe(bundle.profile.confidence);
      expect(dto.evidenceContext?.priority).toBe(bundle.profile.priority);
    }

    expect(card.primaryPackage).toBe("fastify");
    expect(details.narrative.primaryPackage).toBe("fastify");
    expect(check.title.toLowerCase()).toContain("fastify");
  });
});
