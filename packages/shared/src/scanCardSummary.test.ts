import { describe, it, expect } from "vitest";
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
    expect(queued.headline).toBe("Scan in progress");
    expect(queued.summaryLine).toBe("Waiting for results…");
    expect(queued.mergePosture).toBeNull();

    const running = deriveScanCardSummary(null, "running");
    expect(running.headline).toBe("Scan in progress");
  });

  it("returns failed copy", () => {
    const failed = deriveScanCardSummary(null, "failed");
    expect(failed.headline).toBe("Analysis could not be completed");
    expect(failed.mergePosture).toBeNull();
  });

  it("derives posture headline and risk index for done scans", () => {
    const r = {
      ...baseResult,
      totalScore: 72,
      decision: {
        recommendation: "risky" as const,
        confidence: "high" as const,
        reasoning: ["Auth boundary change"],
      },
    } satisfies ScanResult;
    const summary = deriveScanCardSummary(r, "done");
    expect(summary.mergePosture).toBe("risky");
    expect(summary.headline).toBe("Risky");
    expect(summary.riskIndex).toBe(72);
    expect(summary.riskIndexBand).toBe("high");
    expect(summary.summaryLine).toBe("Auth boundary change");
  });

  it("uses safe copy when posture is safe and no findings", () => {
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
    expect(summary.summaryLine).toBe("No merge blockers detected");
  });

  it("caps top affected areas at 2", () => {
    const r = {
      ...baseResult,
      decision: {
        recommendation: "needs_review" as const,
        confidence: "medium" as const,
        reasoning: ["Review needed"],
      },
      explain: {
        reasons: [
          { id: "1", layer: "security", title: "A", scoreImpact: -10 },
          { id: "2", layer: "security", title: "B", scoreImpact: -9 },
          { id: "3", layer: "security", title: "C", scoreImpact: -8 },
        ],
      },
    } satisfies ScanResult;
    const summary = deriveScanCardSummary(r, "done");
    expect(summary.topAffectedAreas).toHaveLength(2);
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
      isPipelineCardSummary({
        mergePosture: null,
        riskIndex: null,
        riskIndexBand: null,
        headline: "Scan in progress",
        summaryLine: "Waiting for results…",
        findingCounts: null,
        topAffectedAreas: [],
      }),
    ).toBe(true);
  });

  it("detects hybrid completed posture with pipeline summary line", () => {
    expect(
      isPipelineCardSummary({
        mergePosture: "risky",
        riskIndex: 72,
        riskIndexBand: "high",
        headline: "Risky",
        summaryLine: "Waiting for results…",
        findingCounts: null,
        topAffectedAreas: [],
      }),
    ).toBe(true);
  });
});

describe("isPipelinePlaceholderCopy", () => {
  it("identifies waiting copy", () => {
    expect(isPipelinePlaceholderCopy("Waiting for results…")).toBe(true);
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
    expect(summary.mergePosture).toBe("risky");
    expect(summary.headline).toBe("Risky");
    expect(summary.riskIndex).toBe(72);
    expect(summary.summaryLine).toBe("Auth boundary change");
  });

  it("does not inject pipeline placeholder summaryText", () => {
    const summary = deriveScanCardSummaryFromDenormalized(
      "risky",
      72,
      "Waiting for results…",
      "done",
    );
    expect(summary.mergePosture).toBe("risky");
    expect(summary.summaryLine).not.toBe("Waiting for results…");
  });
});

describe("resolvePrScanCardSummary", () => {
  it("returns risk summary when wire status is running but decision exists", () => {
    const summary = resolvePrScanCardSummary({
      pipelineStatus: "running",
      decision: "risky",
      totalScore: 80,
      summaryText: "Waiting for results…",
      result: null,
    });
    expect(summary.mergePosture).toBe("risky");
    expect(summary.headline).toBe("Risky");
    expect(summary.summaryLine).not.toBe("Waiting for results…");
  });
});
