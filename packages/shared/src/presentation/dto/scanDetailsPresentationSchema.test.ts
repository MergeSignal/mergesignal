import { describe, expect, it } from "vitest";

import { buildScanDetailsPresentation } from "../orchestration/buildScanDetailsPresentation.js";
import { scanResultFastifyRuntime } from "../fixtures/scanResultFixtures.js";
import {
  parseScanDetailsPresentation,
  safeParseScanDetailsPresentation,
} from "./scanDetailsPresentationSchema.js";
import { parseGovernedScanProductResponse } from "../../scanIngressSchema.js";

const SCAN_ID = "11111111-1111-4111-8111-111111111111";

describe("scanDetailsPresentationSchema", () => {
  it("accepts presentation produced by buildScanDetailsPresentation", () => {
    const detail = buildScanDetailsPresentation({
      scanId: SCAN_ID,
      pipelineStatus: "done",
      result: scanResultFastifyRuntime,
    });
    expect(detail).not.toBeNull();
    expect(parseScanDetailsPresentation(detail)).toEqual(detail);
  });

  it("rejects incomplete presentation structure", () => {
    expect(
      safeParseScanDetailsPresentation({
        status: "safe",
        hero: {
          headline: "h",
          verdictLine: "v",
          postureLabel: "Safe",
        },
        narrative: { keyPoints: [], changedPackages: [] },
        metadata: { scanId: SCAN_ID },
      }).success,
    ).toBe(false);
  });

  it("rejects private payload keys on presentation", () => {
    const detail = buildScanDetailsPresentation({
      scanId: SCAN_ID,
      pipelineStatus: "done",
      result: scanResultFastifyRuntime,
    });
    expect(detail).not.toBeNull();
    expect(
      safeParseScanDetailsPresentation({
        ...detail,
        result: { assessment: {} },
      }).success,
    ).toBe(false);
    expect(
      safeParseScanDetailsPresentation({
        ...detail,
        collectionContext: { secret: true },
      }).success,
    ).toBe(false);
  });

  it("round-trips through governed product response parser", () => {
    const detail = buildScanDetailsPresentation({
      scanId: SCAN_ID,
      pipelineStatus: "done",
      result: scanResultFastifyRuntime,
    });
    expect(detail).not.toBeNull();
    const response = parseGovernedScanProductResponse({
      kind: "analysis_complete",
      scanId: SCAN_ID,
      detailPresentation: detail,
    });
    expect(response.kind).toBe("analysis_complete");
  });
});
