import { describe, expect, it } from "vitest";
import { buildScanPresentationBundle } from "./presentation/orchestration/buildScanPresentationBundle.js";
import { presentDashboardCard } from "./presentation/presenters/presentDashboardCard.js";
import { presentScanDetails } from "./presentation/presenters/presentScanDetails.js";
import { presentGitHubPrComment } from "./presentation/presenters/presentGitHubPrComment.js";
import { renderGitHubCheckRunMarkdown } from "./presentation/render/renderGitHubCheckRunMarkdown.js";
import { presentGitHubCheckRun } from "./presentation/presenters/presentGitHubCheckRun.js";
import { scanResultFastifyRuntime } from "./presentation/fixtures/scanResultFixtures.js";

const ORIGIN = "https://app.example.com";
const SCAN_ID = "22222222-2222-4222-8222-222222222222";

describe("narrative parity across consumers", () => {
  it("card, detail, GitHub share primary package and reachability story", () => {
    const bundle = buildScanPresentationBundle({
      result: scanResultFastifyRuntime,
      pipelineStatus: "done",
    })!;

    const card = presentDashboardCard(bundle);
    const detail = presentScanDetails(bundle, {
      scanId: SCAN_ID,
    });
    const checkRun = renderGitHubCheckRunMarkdown(
      presentGitHubCheckRun(bundle, {
        scanId: SCAN_ID,
        webAppOrigin: ORIGIN,
        baseline: false,
      }),
    );
    const prComment = presentGitHubPrComment(bundle);

    expect(detail.narrative.primaryPackage).toBe("fastify");
    expect(card.reachVisibility).toBe("prominent");
    expect(card.verdict?.scopeLabel).toBeTruthy();

    const asciiOnly = /^[\x00-\x7F]*$/;
    expect(asciiOnly.test(checkRun)).toBe(true);
    expect(checkRun.toLowerCase()).toContain("fastify");
    expect(prComment.title.toLowerCase()).toContain("review");
  });
});
