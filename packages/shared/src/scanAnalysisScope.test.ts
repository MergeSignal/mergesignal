import { describe, expect, it } from "vitest";
import {
  freshOutputExpectationFromScanRequest,
  resolveScanAnalysisScope,
  scanAnalysisScopeFromQueueJob,
} from "./scanAnalysisScope.js";

describe("scanAnalysisScope", () => {
  it("defaults to repository when unset", () => {
    expect(resolveScanAnalysisScope({})).toBe("repository");
    expect(freshOutputExpectationFromScanRequest({})).toBe("repository");
  });

  it("honors explicit scanAnalysisScope", () => {
    expect(
      resolveScanAnalysisScope({ scanAnalysisScope: "change_request" }),
    ).toBe("change_request");
  });

  it("derives change_request from GitHub queue job context", () => {
    expect(
      scanAnalysisScopeFromQueueJob({
        github: {
          owner: "acme",
          repo: "app",
          prNumber: 1,
          headSha: "sha",
          installationId: 1,
        },
      }),
    ).toBe("change_request");
    expect(scanAnalysisScopeFromQueueJob({})).toBe("repository");
  });
});
