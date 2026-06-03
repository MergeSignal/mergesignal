import { describe, it, expect } from "vitest";
import {
  buildRepoPullHealthViewModel,
  type PrScanIndexResponse,
} from "./repo-health-view-model";
import type { GithubOpenPR } from "./github-open-pull-requests";
import type { ScanCardSummary } from "@mergesignal/shared";

function makeCardSummary(
  overrides: Partial<ScanCardSummary> = {},
): ScanCardSummary {
  return {
    mergePosture: null,
    riskIndex: null,
    riskIndexBand: null,
    headline: "Risky",
    summaryLine: null,
    findingCounts: null,
    topAffectedAreas: [],
    operationalObservations: [],
    supportingLine: null,
    narrativeMode: "graph_fallback",
    codeIntelligenceAvailable: false,
    changedPackagesDisplay: null,
    runtimeSurfaceLabel: null,
    reachabilityLabel: null,
    blastRadiusLabel: null,
    affectedAreas: [],
    primaryInsight: null,
    structuralOnlyDisclaimer: null,
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
  }>,
): PrScanIndexResponse {
  const byPrNumber: PrScanIndexResponse["byPrNumber"] = {};
  for (const e of entries) {
    const pipelineStatus = (e.pipelineStatus ??
      e.status ??
      "done") as PrScanIndexResponse["byPrNumber"][string]["pipelineStatus"];
    const isActivePipeline =
      pipelineStatus === "queued" || pipelineStatus === "running";
    const totalScore = e.score ?? (isActivePipeline ? null : 50);
    const mergePosture =
      e.decision === "safe" ||
      e.decision === "needs_review" ||
      e.decision === "risky"
        ? e.decision
        : null;
    const cardSummary = isActivePipeline
      ? makeCardSummary({
          mergePosture: null,
          riskIndex: null,
          riskIndexBand: null,
          headline: "Scan in progress",
          summaryLine: "Waiting for results…",
        })
      : makeCardSummary({
          mergePosture,
          riskIndex: totalScore,
          riskIndexBand:
            totalScore != null && totalScore > 60
              ? "high"
              : totalScore != null && totalScore > 30
                ? "medium"
                : "low",
          headline: mergePosture === "safe" ? "Safe" : "Risky",
        });
    byPrNumber[String(e.prNumber)] = {
      scanId: `scan-${e.prNumber}`,
      pipelineStatus,
      cardSummary,
      status: pipelineStatus,
      decision: e.decision ?? null,
      totalScore,
      githubPrNumber: e.prNumber,
      githubHeadSha: e.headSha ?? `sha${e.prNumber}`,
      githubBaseRef: "main",
      createdAt: new Date(2026, 0, 1).toISOString(),
      scannedAt: isActivePipeline
        ? null
        : (e.scannedAt ?? new Date(2026, 0, 1, 1).toISOString()),
      resultGeneratedAt: isActivePipeline
        ? null
        : (e.scannedAt ?? new Date(2026, 0, 1, 1).toISOString()),
      summaryText: null,
      topAffectedAreas: [],
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
    expect(vm.rows[0]!.cardSummary).toBeNull();
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

  it("promotes running scans with completion evidence to ready summary", () => {
    const scannedAt = "2026-02-01T12:00:00.000Z";
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([
        {
          prNumber: 1,
          pipelineStatus: "running",
          decision: "risky",
          score: 72,
          scannedAt,
        },
      ]),
      false,
    );
    expect(vm.rows[0]!.presentationState).toBe("ready");
    expect(vm.rows[0]!.cardSummary?.headline).toBe("Risky");
    expect(vm.rows[0]!.cardSummary?.summaryLine).not.toBe(
      "Waiting for results…",
    );
  });

  it("rebuilds pipeline placeholder cardSummary for ready scans", () => {
    const index: PrScanIndexResponse = {
      repoId: "acme/repo",
      byPrNumber: {
        "1": {
          scanId: "scan-1",
          pipelineStatus: "done",
          cardSummary: makeCardSummary({
            mergePosture: null,
            riskIndex: null,
            riskIndexBand: null,
            headline: "Scan in progress",
            summaryLine: "Waiting for results…",
          }),
          status: "done",
          decision: "risky",
          totalScore: 80,
          githubPrNumber: 1,
          githubHeadSha: "sha1",
          githubBaseRef: "main",
          createdAt: new Date(2026, 0, 1).toISOString(),
          scannedAt: new Date(2026, 0, 1, 1).toISOString(),
          resultGeneratedAt: new Date(2026, 0, 1, 1).toISOString(),
          summaryText: "Waiting for results…",
          topAffectedAreas: [],
        },
      },
      aggregates: {
        totalCovered: 1,
        byDecision: { safe: 0, needs_review: 0, risky: 1 },
      },
    };

    const vm = buildRepoPullHealthViewModel([makePR(1)], index, false);
    expect(vm.rows[0]!.presentationState).toBe("ready");
    expect(vm.rows[0]!.cardSummary?.headline).toBe("Risky");
    expect(vm.rows[0]!.cardSummary?.summaryLine).not.toBe(
      "Waiting for results…",
    );
  });

  it("resolves ready scan when status running but decision exists without scannedAt", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([
        {
          prNumber: 1,
          pipelineStatus: "running",
          decision: "needs_review",
          score: 55,
        },
      ]),
      false,
    );
    expect(vm.rows[0]!.presentationState).toBe("ready");
    expect(vm.rows[0]!.cardSummary?.headline).toBe("Needs review");
    expect(vm.rows[0]!.cardSummary?.summaryLine).not.toBe(
      "Waiting for results…",
    );
  });

  it("propagates hasMore", () => {
    const vm = buildRepoPullHealthViewModel([makePR(1)], makeIndex([]), true);
    expect(vm.hasMore).toBe(true);
  });

  it("trusts API cardSummary when denormalized fields are null", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      {
        repoId: "acme/repo",
        byPrNumber: {
          "1": {
            scanId: "scan-1",
            pipelineStatus: "done",
            cardSummary: makeCardSummary({
              mergePosture: "needs_review",
              riskIndex: 48,
              riskIndexBand: "medium",
              headline: "Needs review",
              summaryLine: "Dependency upgrade needs review",
            }),
            status: "done",
            decision: null,
            totalScore: null,
            githubPrNumber: 1,
            githubHeadSha: "sha1",
            githubBaseRef: "main",
            createdAt: new Date(2026, 0, 1).toISOString(),
            scannedAt: new Date(2026, 0, 1, 1).toISOString(),
            resultGeneratedAt: new Date(2026, 0, 1, 1).toISOString(),
            summaryText: null,
            topAffectedAreas: ["Auth flow"],
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
    expect(vm.rows[0]!.cardSummary?.headline).toBe("Needs review");
    expect(vm.rows[0]!.cardSummary?.summaryLine).toBe(
      "Dependency upgrade needs review",
    );
  });

  it("promotes running wire status to ready when scannedAt exists", () => {
    const scannedAt = "2026-02-01T12:00:00.000Z";
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([
        {
          prNumber: 1,
          pipelineStatus: "running",
          decision: "safe",
          score: 12,
          scannedAt,
        },
      ]),
      false,
    );
    expect(vm.rows[0]!.presentationState).toBe("ready");
    expect(vm.rows[0]!.posture).toBe("safe");
  });
});
