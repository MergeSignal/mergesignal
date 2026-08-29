import { describe, expect, it, vi } from "vitest";
import type { ScanQueueJob } from "@mergesignal/shared";
import * as githubFiles from "../src/github-files.js";
import { prepareScanContext } from "../src/prepareScanContext.js";

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

describe("prepareScanContext provider boundary", () => {
  it("normalizes repository queue facts to repository scanAnalysisScope", async () => {
    const job: ScanQueueJob = {
      scanId: "boundary-repo",
      repoId: "acme/app",
      dependencyGraph: {},
      lockfile: { manager: "pnpm", content: pnpmHead },
      repoSource: {
        provider: "github",
        owner: "acme",
        repo: "app",
        sha: "abc123",
        installationId: 1,
      },
    };

    const prepared = await prepareScanContext(job);

    expect(prepared.scanRequest.scanAnalysisScope).toBe("repository");
    expect(Object.hasOwn(prepared.scanRequest, "github")).toBe(false);
    expect(Object.hasOwn(prepared.scanRequest, "repoSource")).toBe(false);
  });

  it("preserves normalized evidence while omitting provider metadata from ScanRequest", async () => {
    const fetchSpy = vi
      .spyOn(githubFiles, "fetchGitHubFiles")
      .mockResolvedValue({
        files: new Map([["src/index.ts", "import react from 'react';"]]),
        skipped: [],
      });

    const job: ScanQueueJob = {
      scanId: "boundary-1",
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
      github: {
        owner: "acme",
        repo: "app",
        prNumber: 7,
        headSha: "abc123",
        installationId: 1,
      },
    };

    const prepared = await prepareScanContext(job);

    expect(job.repoSource).toBeDefined();
    expect(job.github?.prNumber).toBe(7);
    expect(prepared.scanRequest.scanAnalysisScope).toBe("change_request");
    expect(Object.hasOwn(prepared.scanRequest, "github")).toBe(false);
    expect(Object.hasOwn(prepared.scanRequest, "repoSource")).toBe(false);
    expect(prepared.scanRequest.changedPackages).toContain("react");
    expect(prepared.scanRequest.lockfilePackageDelta?.updated).toContain(
      "react",
    );
    expect(prepared.scanRequest.baseLockfile).toEqual(job.baseLockfile);
    expect(prepared.codeAnalysis?.fileContents.size).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
