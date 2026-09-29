import { describe, expect, it, vi } from "vitest";
import type { ScanQueueJob } from "@mergesignal/shared";

import { __resetFileCacheForTests } from "./file-cache.js";
import * as githubFiles from "./github-files.js";
import { prepareScanContext } from "./prepareScanContext.js";
import { REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES } from "./repository-evidence/corpusPolicy.js";

const pnpmBase = `
lockfileVersion: '9.0'
packages:
  react@17.0.2:
    resolution: {integrity: sha512-test}
`;

const pnpmHead = `
lockfileVersion: '9.0'
packages:
  react@18.2.0:
    resolution: {integrity: sha512-test2}
`;

const job: ScanQueueJob = {
  scanId: "cache-parity",
  repoId: "acme/app",
  dependencyGraph: {},
  lockfile: { manager: "pnpm", content: pnpmHead },
  baseLockfile: { manager: "pnpm", content: pnpmBase },
  repoSource: {
    provider: "github",
    owner: "acme",
    repo: "app",
    sha: "abc123",
    installationId: 1,
  },
};

describe("prepareScanContext repository evidence cache parity", () => {
  it("preserves acquisition accounting on cache hit", async () => {
    __resetFileCacheForTests();
    const fetchResult = {
      files: new Map([["src/index.ts", "import react from 'react';"]]),
      sourceFilesSkipped: 0,
      repositoryEvidenceEligibleCandidateCount: 5_000,
      repositoryEvidenceSelectedCandidateCount:
        REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
      repositoryEvidenceCapTruncatedCandidateCount: 4_000,
      sourceFilesSkippedOversized: 0,
      sourceFilesSkippedFetchError: 0,
    };

    const fetchSpy = vi
      .spyOn(githubFiles, "fetchGitHubFiles")
      .mockResolvedValue(fetchResult);

    const fresh = await prepareScanContext(job);
    expect(
      fresh.preparationSummary.repositoryEvidenceCapTruncatedCandidateCount,
    ).toBe(4_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockClear();
    const cached = await prepareScanContext(job);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(cached.preparationSummary).toMatchObject({
      repositoryEvidenceEligibleCandidateCount: 5_000,
      repositoryEvidenceSelectedCandidateCount:
        REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
      repositoryEvidenceCapTruncatedCandidateCount: 4_000,
      sourceFilesFetched: 1,
      sourceFilesSkipped: 0,
      sourceFilesSkippedOversized: 0,
      sourceFilesSkippedFetchError: 0,
    });

    fetchSpy.mockRestore();
    __resetFileCacheForTests();
  });
});
