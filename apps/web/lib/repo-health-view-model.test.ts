import { describe, it, expect } from "vitest";
import {
  buildRepoPullHealthViewModel,
  type PrScanIndexResponse,
} from "./repo-health-view-model";
import type { GithubOpenPR } from "./github-open-pull-requests";

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
    status?: string;
    score?: number | null;
    headSha?: string;
  }>,
): PrScanIndexResponse {
  const byPrNumber: PrScanIndexResponse["byPrNumber"] = {};
  for (const e of entries) {
    byPrNumber[String(e.prNumber)] = {
      scanId: `scan-${e.prNumber}`,
      status: e.status ?? "done",
      decision: e.decision ?? null,
      totalScore: e.score ?? 50,
      githubPrNumber: e.prNumber,
      githubHeadSha: e.headSha ?? `sha${e.prNumber}`,
      githubBaseRef: "main",
      createdAt: new Date(2026, 0, 1).toISOString(),
      resultGeneratedAt: new Date(2026, 0, 1).toISOString(),
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
    expect(vm.rows[0]!.scanState).toBe("not_scanned");
    expect(vm.rows[0]!.posture).toBeNull();
  });

  it("marks PR as outdated when headSha differs", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1, { headSha: "new-sha" })],
      makeIndex([{ prNumber: 1, decision: "safe", headSha: "old-sha" }]),
      false,
    );
    expect(vm.rows[0]!.scanState).toBe("outdated");
    expect(vm.rows[0]!.isOutdated).toBe(true);
  });

  it("marks PR as in_progress for queued status", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([{ prNumber: 1, status: "queued" }]),
      false,
    );
    expect(vm.rows[0]!.scanState).toBe("in_progress");
  });

  it("marks PR as in_progress for running status", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([{ prNumber: 1, status: "running" }]),
      false,
    );
    expect(vm.rows[0]!.scanState).toBe("in_progress");
  });

  it("normalizes scan status casing from API", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([{ prNumber: 1, status: "DONE", decision: "safe" }]),
      false,
    );
    expect(vm.rows[0]!.scanState).toBe("done");
  });

  it("marks PR as failed for failed status", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1)],
      makeIndex([{ prNumber: 1, status: "failed" }]),
      false,
    );
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
    expect(nums[0]).toBe(2); // risky
    expect(nums[1]).toBe(3); // needs_review
    expect(nums[2]).toBe(1); // safe
    expect(nums[3]).toBe(4); // not_scanned
  });

  it("sorts by score desc within same posture", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1), makePR(2)],
      makeIndex([
        { prNumber: 1, decision: "risky", score: 60 },
        { prNumber: 2, decision: "risky", score: 90 },
      ]),
      false,
    );
    expect(vm.rows[0]!.pr.number).toBe(2); // score 90 first
  });

  it("computes byPosture counts", () => {
    const vm = buildRepoPullHealthViewModel(
      [makePR(1), makePR(2), makePR(3), makePR(4)],
      makeIndex([
        { prNumber: 1, decision: "risky" },
        { prNumber: 2, decision: "risky" },
        { prNumber: 3, decision: "needs_review" },
        { prNumber: 4, decision: "safe" },
      ]),
      false,
    );
    expect(vm.byPosture.risky).toBe(2);
    expect(vm.byPosture.needs_review).toBe(1);
    expect(vm.byPosture.safe).toBe(1);
  });

  it("propagates hasMore", () => {
    const vm = buildRepoPullHealthViewModel([makePR(1)], makeIndex([]), true);
    expect(vm.hasMore).toBe(true);
  });
});
