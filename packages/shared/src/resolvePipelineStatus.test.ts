import { describe, expect, it } from "vitest";

import {
  hasScanCompletionEvidence,
  resolvePipelineStatus,
} from "./resolvePipelineStatus.js";

describe("resolvePipelineStatus", () => {
  it("treats indeterminate decision as completed analysis (not pipeline failure)", () => {
    expect(
      resolvePipelineStatus("running", { decision: "indeterminate" }),
    ).toBe("done");
    expect(hasScanCompletionEvidence({ decision: "indeterminate" })).toBe(true);
  });

  it("does not treat unknown decision as completion", () => {
    expect(resolvePipelineStatus("running", { decision: "unknown" })).toBe(
      "running",
    );
  });
});
