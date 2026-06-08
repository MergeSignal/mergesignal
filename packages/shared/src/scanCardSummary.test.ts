import { describe, it, expect } from "vitest";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import {
  aggregateFindingCounts,
  deriveRiskIndexBand,
  deriveScanCardSummary,
  deriveScanCardSummaryFromDenormalized,
  isPipelineCardSummary,
  isPipelinePlaceholderCopy,
  resolvePipelineStatus,
  resolvePrScanCardSummary,
  staleScanSubline,
} from "./scanCardSummary.js";
import type { DashboardCardPresentation } from "./presentation/dto/dashboardCardPresentation.js";
import type { ScanResult } from "./types.js";

const baseResult = {
  totalScore: 10,
  layerScores: {
    security: 1,
    maintainability: 2,
    ecosystem: 3,
    upgradeImpact: 4,
  },
  findings: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
} satisfies ScanResult;

function pipelineCard(
  overrides: Partial<DashboardCardPresentation> = {},
): DashboardCardPresentation {
  return {
    pipeline: {
      status: "queued",
      headline: scanSurfaceCopy.pipeline.scanRunning,
      subheadline: scanSurfaceCopy.pipeline.scanIncomplete,
    },
    headline: scanSurfaceCopy.pipeline.scanRunning,
    insights: [],
    verification: [],
    layout: "standard",
    detailActionLabel: scanSurfaceCopy.presentation.actionLabelReview,
    sortKey: { postureRank: -1, riskIndex: -1 },
    ...overrides,
  };
}

describe("deriveRiskIndexBand", () => {
  it("maps score thresholds", () => {
    expect(deriveRiskIndexBand(0)).toBe("low");
    expect(deriveRiskIndexBand(30)).toBe("low");
    expect(deriveRiskIndexBand(31)).toBe("medium");
    expect(deriveRiskIndexBand(60)).toBe("medium");
    expect(deriveRiskIndexBand(61)).toBe("high");
    expect(deriveRiskIndexBand(null)).toBeNull();
  });
});

describe("aggregateFindingCounts", () => {
  it("counts by severity", () => {
    expect(
      aggregateFindingCounts([
        {
          id: "1",
          title: "a",
          description: "d",
          severity: "critical",
          packageName: "p",
        },
        {
          id: "2",
          title: "b",
          description: "d",
          severity: "high",
          packageName: "p",
        },
        {
          id: "3",
          title: "c",
          description: "d",
          severity: "high",
          packageName: "p",
        },
      ]),
    ).toEqual({ critical: 1, high: 2, medium: 0, low: 0 });
  });
});

describe("deriveScanCardSummary", () => {
  it("returns scanning copy for queued/running", () => {
    const queued = deriveScanCardSummary(null, "queued");
    expect(queued.headline).toBe(scanSurfaceCopy.pipeline.scanRunning);
    expect(queued.pipeline?.status).toBe("queued");
    expect(queued.verdict).toBeUndefined();

    const running = deriveScanCardSummary(null, "running");
    expect(running.headline).toBe(scanSurfaceCopy.pipeline.scanRunning);
    expect(running.pipeline?.status).toBe("running");
  });

  it("returns failed copy", () => {
    const failed = deriveScanCardSummary(null, "failed");
    expect(failed.headline).toBe(scanSurfaceCopy.pipeline.analysisIncomplete);
    expect(failed.pipeline?.status).toBe("failed");
  });

  it("derives posture and risk index for done scans", () => {
    const r = {
      ...baseResult,
      totalScore: 72,
      decision: {
        recommendation: "risky" as const,
        confidence: "high" as const,
        reasoning: ["Auth boundary change"],
      },
      explain: {
        reasons: [
          {
            id: "upgrade.1",
            layer: "upgradeImpact",
            title: "Large upgrade blast radius",
            scoreImpact: 20,
          },
        ],
      },
    } satisfies ScanResult;
    const summary = deriveScanCardSummary(r, "done");
    expect(summary.verdict?.posture).toBe("risky");
    expect(summary.headline).toBe(
      scanSurfaceCopy.presentation.limitedContextHeadline,
    );
    expect(summary.sortKey.riskIndex).toBe(72);
  });

  it("keeps quiet safe cards minimal without extra key points beyond defaults", () => {
    const r = {
      ...baseResult,
      totalScore: 12,
      decision: {
        recommendation: "safe" as const,
        confidence: "high" as const,
        reasoning: [],
      },
    } satisfies ScanResult;
    const summary = deriveScanCardSummary(r, "done");
    expect(summary.verdict?.posture).toBe("safe");
    expect(summary.insights.length).toBeGreaterThan(0);
  });

  it("surfaces catalog key points from explain signals", () => {
    const r = {
      ...baseResult,
      decision: {
        recommendation: "needs_review" as const,
        confidence: "medium" as const,
        reasoning: ["Review needed"],
      },
      explain: {
        reasons: [
          {
            id: "1",
            layer: "ecosystem",
            title: "graph.transitive volume",
            scoreImpact: 18,
          },
          {
            id: "2",
            layer: "ecosystem",
            title: "graph.duplicates",
            scoreImpact: 12,
          },
          { id: "3", layer: "security", title: "C", scoreImpact: -8 },
        ],
      },
    } satisfies ScanResult;
    const summary = deriveScanCardSummary(r, "done");
    expect(summary.insights.length).toBeGreaterThan(0);
  });

  it("exports stale subline constant", () => {
    expect(staleScanSubline()).toBe("Based on earlier commit");
  });
});

describe("resolvePipelineStatus", () => {
  it("promotes running to done when completion evidence exists", () => {
    expect(
      resolvePipelineStatus("running", {
        scannedAt: "2026-01-01T00:00:00.000Z",
        decision: "risky",
      }),
    ).toBe("done");
  });

  it("promotes running to done with decision only (no scannedAt)", () => {
    expect(
      resolvePipelineStatus("running", {
        decision: "risky",
      }),
    ).toBe("done");
  });

  it("promotes running to done with totalScore only", () => {
    expect(resolvePipelineStatus("running", { totalScore: 72 })).toBe("done");
  });

  it("promotes running to done with scannedAt only", () => {
    expect(
      resolvePipelineStatus("running", {
        scannedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe("done");
  });

  it("keeps running when no completion evidence", () => {
    expect(resolvePipelineStatus("running", {})).toBe("running");
  });
});

describe("isPipelineCardSummary", () => {
  it("detects scanning placeholder summaries", () => {
    expect(
      isPipelineCardSummary(
        pipelineCard({
          pipeline: {
            status: "queued",
            headline: scanSurfaceCopy.pipeline.scanRunning,
            subheadline: scanSurfaceCopy.pipeline.scanIncomplete,
          },
        }),
      ),
    ).toBe(true);
  });

  it("detects failed pipeline summaries", () => {
    expect(
      isPipelineCardSummary(
        pipelineCard({
          pipeline: {
            status: "failed",
            headline: scanSurfaceCopy.pipeline.analysisIncomplete,
          },
        }),
      ),
    ).toBe(true);
  });
});

describe("isPipelinePlaceholderCopy", () => {
  it("identifies waiting copy", () => {
    expect(isPipelinePlaceholderCopy("Waiting for results...")).toBe(true);
    expect(isPipelinePlaceholderCopy("Auth change")).toBe(false);
  });
});

describe("deriveScanCardSummaryFromDenormalized", () => {
  it("builds risky summary from denormalized columns", () => {
    const summary = deriveScanCardSummaryFromDenormalized(
      "risky",
      72,
      "Auth boundary change",
      "done",
    );
    expect(summary.verdict?.posture).toBe("risky");
    expect(summary.sortKey.riskIndex).toBe(72);
    expect(summary.pipeline).toBeUndefined();
  });

  it("does not inject pipeline placeholder summaryText", () => {
    const summary = deriveScanCardSummaryFromDenormalized(
      "risky",
      72,
      "Waiting for results...",
      "done",
    );
    expect(summary.verdict?.posture).toBe("risky");
    expect(summary.pipeline).toBeUndefined();
  });

  it("does not inject raw generic summaryText on quiet safe cards", () => {
    const summary = deriveScanCardSummaryFromDenormalized(
      "safe",
      12,
      "No high-confidence merge risks from this PR dependency change",
      "done",
    );
    expect(summary.verdict?.posture).toBe("safe");
    expect(summary.pipeline).toBeUndefined();
  });
});

describe("resolvePrScanCardSummary", () => {
  it("returns risk summary when wire status is running but decision exists", () => {
    const summary = resolvePrScanCardSummary({
      pipelineStatus: "running",
      decision: "risky",
      totalScore: 80,
      summaryText: "Waiting for results...",
      result: null,
    });
    expect(summary.verdict?.posture).toBe("risky");
    expect(summary.pipeline).toBeUndefined();
  });
});
