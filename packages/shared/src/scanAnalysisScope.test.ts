import { describe, expect, it } from "vitest";
import {
  freshOutputExpectationFromScanRequest,
  resolveScanAnalysisScope,
  scanAnalysisScopeFromQueueJob,
} from "./scanAnalysisScope.js";
import type { ScanQueueJob } from "./types.js";

const githubContext = {
  owner: "acme",
  repo: "app",
  prNumber: 1,
  headSha: "sha",
  installationId: 1,
} as const;

function queueJob(overrides: Partial<ScanQueueJob> = {}): ScanQueueJob {
  return {
    scanId: "scan-1",
    repoId: "acme/app",
    dependencyGraph: {},
    ...overrides,
  };
}

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

  it("derives change_request from changeIntent on a GitHub pull-request job", () => {
    expect(
      scanAnalysisScopeFromQueueJob(
        queueJob({
          changeIntent: "change_request",
          github: githubContext,
        }),
      ),
    ).toBe("change_request");
  });

  it("derives change_request from changeIntent without GitHub context", () => {
    expect(
      scanAnalysisScopeFromQueueJob(
        queueJob({ changeIntent: "change_request" }),
      ),
    ).toBe("change_request");
  });

  it("does not derive change_request from GitHub context alone", () => {
    expect(
      scanAnalysisScopeFromQueueJob(queueJob({ github: githubContext })),
    ).toBe("repository");
  });

  it("keeps repository scope when intent is repository_scope or absent", () => {
    expect(
      scanAnalysisScopeFromQueueJob(
        queueJob({ changeIntent: "repository_scope" }),
      ),
    ).toBe("repository");
    expect(scanAnalysisScopeFromQueueJob(queueJob())).toBe("repository");
  });
});
