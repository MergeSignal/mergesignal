import { describe, it, expect } from "vitest";
import {
  buildRepoPullHealthViewModel,
  type PrScanIndexResponse,
} from "./repo-health-view-model";
import type { GithubOpenPR } from "./github-open-pull-requests";
import type { DashboardCardPresentation } from "@mergesignal/shared";
import { scanSurfaceCopy } from "@mergesignal/shared";

function makeCardPresentation(
  overrides: Partial<DashboardCardPresentation> = {},
): DashboardCardPresentation {
  return {
    verdict: {
      posture: "risky",
      postureLabel: "Risky",
    },
    headline: "Risky dependency upgrade",
    insights: [],
    verification: [],
    layout: "standard",
    detailActionLabel: scanSurfaceCopy.presentation.actionLabelReview,
    sortKey: { postureRank: 2, riskIndex: 72 },
    ...overrides,
  };
}

function makePR(
  num: number,
  overrides: Partial<GithubOpenPR> = {},
): GithubOpenPR {
  return {
    number: num,
    title: `PR #${num}`,
    baseRef: "main",
    headSha: `sha${num}`,
    updatedAt: new Date(2026, 0, num).toISOString(),
    htmlUrl: `https://github.com/acme/repo/pull/${num}`,
    ...overrides,
  };
}

function makeIndex(
  entries: Array<{
    prNumber: number;
    decision?: string | null;
    pipelineStatus?: string;
    status?: string;
    score?: number | null;
    headSha?: string;
    scannedAt?: string;
    presentationState?: PrScanIndexResponse["byPrNumber"][string]["presentationState"];
    cardPresentation?: DashboardCardPresentation;
  }>,
): PrScanIndexResponse {
  const byPrNumber: PrScanIndexResponse["byPrNumber"] = {};
  for (const e of entries) {
    const pipelineStatus = (e.pipelineStatus ??
      e.status ??
      "done") as PrScanIndexResponse["byPrNumber"][string]["pipelineStatus"];
    const isActivePipeline =
      pipelineStatus === "queued" || pipelineStatus === "running";
    const cardPresentation =
      e.cardPresentation ??
      (isActivePipeline
        ? makeCardPresentation({
            pipeline: {
              status: pipelineStatus as "queued" | "running",
              headline: scanSurfaceCopy.pipeline.scanRunning,
              subheadline: scanSurfaceCopy.pipeline.scanIncomplete,
            },
            headline: scanSurfaceCopy.pipeline.scanRunning,
            verdict: undefined,
            sortKey: { postureRank: -1, riskIndex: -1 },
          })
        : makeCardPresentation({
            verdict: {
              posture:
                e.decision === "safe" ||
                e.decision === "needs_review" ||
                e.decision === "risky"
                  ? e.decision
                  : "risky",
              postureLabel:
                e.decision === "safe"
                  ? "Safe"
                  : e.decision === "needs_review"
                    ? "Needs review"
                    : "Risky",
            },
            headline:
              e.decision === "safe"
                ? "Safe upgrade"
                : e.decision === "needs_review"
                  ? "Needs review"
                  : "Risky upgrade",
            sortKey: {
              postureRank:
                e.decision === "safe"
                  ? 0
                  : e.decision === "needs_review"
                    ? 1
                    : 2,
              riskIndex: e.score ?? 50,
            },
          }));

    byPrNumber[String(e.prNumber)] = {
      scanId: `scan-${e.prNumber}`,
      pipelineStatus,
      presentationState: e.presentationState,
      cardPresentation,
      createdAt: new Date(2026, 0, 1).toISOString(),
      githubPrNumber: e.prNumber,
      githubHeadSha: e.headSha ?? `sha${e.prNumber}`,
      githubBaseRef: "main",
      scannedAt: isActivePipeline
        ? null
        : (e.scannedAt ?? new Date(2026, 0, 1, 1).toISOString()),
    };
  }
  return {
    repoId: "acme/repo",
    byPrNumber,
    aggregates: {
      totalCovered: entries.length,
      byDecision: { safe: 0, needs_review: 0, risky: 0 },
    },
  };
}

describe("buildRepoPullHealthViewModel", () => {
  it("returns empty rows for no PRs", () => {
    const vm = buildRepoPullHealthViewModel([], makeIndex([]), false);
    expect(vm.rows).toEqual([]);
    expect(vm.totalPRs).toBe(0);
  });

  it("marks PRs with no scan as not_scanned", () => {
    const vm = buildRepoPullHealthViewModel([makePR(1)], makeIndex([]), false);
    expect(vm.rows[0]!.presentationState).toBe("not_scanned");
    expect(vm.rows[0]!.scanState).toBe("not_scanned");
    expect(vm.rows[0]!.posture).toBeNull();
    expect(vm.rows[0]!.cardPresentation).toBeNull();
  });

  it("marks PR as stale when headSha differs", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1, { headSha: "new-sha" })],
      makeIndex([{ prNumber: 1, decision: "safe", headSha: "old-sha" }]),
      false,
    );
    expect(vm.rows[0]!.presentationState).toBe("stale");
    expect(vm.rows[0]!.scanState).toBe("outdated");
    expect(vm.rows[0]!.isOutdated).toBe(true);
  });

  it("marks PR as scanning for queued status", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([{ prNumber: 1, pipelineStatus: "queued" }]),
      false,
    );
    expect(vm.rows[0]!.presentationState).toBe("scanning");
    expect(vm.rows[0]!.scanState).toBe("in_progress");
  });

  it("marks PR as scanning for running status", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([{ prNumber: 1, pipelineStatus: "running" }]),
      false,
    );
    expect(vm.rows[0]!.presentationState).toBe("scanning");
  });

  it("marks PR as ready for done status with matching sha", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([{ prNumber: 1, pipelineStatus: "done", decision: "safe" }]),
      false,
    );
    expect(vm.rows[0]!.presentationState).toBe("ready");
    expect(vm.rows[0]!.scanState).toBe("done");
  });

  it("marks PR as analysis_failed for failed status", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([{ prNumber: 1, pipelineStatus: "failed" }]),
      false,
    );
    expect(vm.rows[0]!.presentationState).toBe("analysis_failed");
    expect(vm.rows[0]!.scanState).toBe("failed");
  });

  it("sorts: risky first, then needs_review, then safe, then not_scanned", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1), makePR(2), makePR(3), makePR(4)],
      makeIndex([
        { prNumber: 1, decision: "safe", score: 20 },
        { prNumber: 2, decision: "risky", score: 80 },
        { prNumber: 3, decision: "needs_review", score: 55 },
      ]),
      false,
    );
    const nums = vm.rows.map((r) => r.pr.number);
    expect(nums[0]).toBe(2);
    expect(nums[1]).toBe(3);
    expect(nums[2]).toBe(1);
    expect(nums[3]).toBe(4);
  });

  it("uses scannedAt for ready rows timestamp", () => {
    const scannedAt = "2026-02-01T12:00:00.000Z";
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([
        {
          prNumber: 1,
          decision: "safe",
          pipelineStatus: "done",
          scannedAt,
        },
      ]),
      false,
    );
    expect(vm.rows[0]!.timestampIso).toBe(scannedAt);
  });

  it("uses API cardPresentation when pipeline is done", () => {
    const scannedAt = "2026-02-01T12:00:00.000Z";
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([
        {
          prNumber: 1,
          pipelineStatus: "done",
          decision: "risky",
          score: 72,
          scannedAt,
          cardPresentation: makeCardPresentation({
            verdict: { posture: "risky", postureLabel: "Risky" },
            headline: "Risky upgrade",
            sortKey: { postureRank: 2, riskIndex: 72 },
          }),
        },
      ]),
      false,
    );
    expect(vm.rows[0]!.presentationState).toBe("ready");
    expect(vm.rows[0]!.cardPresentation?.headline).toBe("Risky upgrade");
    expect(vm.rows[0]!.cardPresentation?.pipeline).toBeUndefined();
  });

  it("trusts API cardPresentation posture when denormalized fields are absent", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      {
        repoId: "acme/repo",
        byPrNumber: {
          "1": {
            scanId: "scan-1",
            pipelineStatus: "done",
            cardPresentation: makeCardPresentation({
              verdict: {
                posture: "needs_review",
                postureLabel: "Needs review",
              },
              headline: "Needs review",
              sortKey: { postureRank: 1, riskIndex: 48 },
              insights: ["Dependency upgrade needs review"],
              scopeAreas: ["Auth flow"],
            }),
            createdAt: new Date(2026, 0, 1).toISOString(),
            githubPrNumber: 1,
            githubHeadSha: "sha1",
            githubBaseRef: "main",
            scannedAt: new Date(2026, 0, 1, 1).toISOString(),
          },
        },
        aggregates: {
          totalCovered: 1,
          byDecision: { safe: 0, needs_review: 1, risky: 0 },
        },
      },
      false,
    );

    expect(vm.rows[0]!.presentationState).toBe("ready");
    expect(vm.rows[0]!.posture).toBe("needs_review");
    expect(vm.rows[0]!.cardPresentation?.headline).toBe("Needs review");
    expect(vm.rows[0]!.cardPresentation?.insights).toContain(
      "Dependency upgrade needs review",
    );
  });

  it("propagates hasMore", () => {
    const vm = buildRepoPullHealthViewModel([makePR(1)], makeIndex([]), true);
    expect(vm.hasMore).toBe(true);
  });

  it("marks surfaces_incomplete without posture and excludes from byPosture", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([
        {
          prNumber: 1,
          pipelineStatus: "done",
          presentationState: "surfaces_incomplete",
          cardPresentation: makeCardPresentation({
            pipeline: {
              status: "failed",
              headline: scanSurfaceCopy.pipeline.surfacesNotSynchronized,
            },
            headline: scanSurfaceCopy.pipeline.surfacesNotSynchronized,
            verdict: undefined,
            sortKey: { postureRank: -1, riskIndex: -1 },
          }),
        },
      ]),
      false,
    );
    expect(vm.rows[0]!.presentationState).toBe("surfaces_incomplete");
    expect(vm.rows[0]!.posture).toBeNull();
    expect(vm.byPosture).toEqual({ risky: 0, needs_review: 0, safe: 0 });
  });

  it("sorts surfaces_incomplete with pipeline rows (not above risky)", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1), makePR(2)],
      makeIndex([
        {
          prNumber: 1,
          presentationState: "surfaces_incomplete",
          pipelineStatus: "done",
          cardPresentation: makeCardPresentation({
            verdict: undefined,
            headline: scanSurfaceCopy.pipeline.surfacesNotSynchronized,
            sortKey: { postureRank: -1, riskIndex: -1 },
          }),
        },
        { prNumber: 2, decision: "risky", score: 80 },
      ]),
      false,
    );
    expect(vm.rows[0]!.pr.number).toBe(2);
    expect(vm.rows[1]!.pr.number).toBe(1);
  });

  it("marks running wire status as scanning even when card has posture", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([
        {
          prNumber: 1,
          pipelineStatus: "running",
          cardPresentation: makeCardPresentation({
            pipeline: {
              status: "running",
              headline: scanSurfaceCopy.pipeline.scanRunning,
            },
            headline: scanSurfaceCopy.pipeline.scanRunning,
            verdict: undefined,
          }),
        },
      ]),
      false,
    );
    expect(vm.rows[0]!.presentationState).toBe("scanning");
  });
});
