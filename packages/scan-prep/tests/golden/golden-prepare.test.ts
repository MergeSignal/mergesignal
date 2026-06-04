import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { ScanQueueJob } from "@mergesignal/shared";
import * as githubFiles from "../../src/github-files.js";
import { prepareScanContext } from "../../src/prepareScanContext.js";

const dir = dirname(fileURLToPath(import.meta.url));

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(dir, name), "utf8")) as T;
}

describe("golden prepareScanContext fixtures", () => {
  it("matches committed snapshot for PR react upgrade (no repo fetch in CI)", async () => {
    const job = loadJson<ScanQueueJob>("pr-react-upgrade.job.json");
    const expected = loadJson<{
      changedPackages: string[];
      lockfilePackageDelta: {
        added: string[];
        removed: string[];
        updated: string[];
      };
      warningCodes: string[];
      codeAnalysisEnabled: boolean;
    }>("pr-react-upgrade.prep.json");

    const prepared = await prepareScanContext(job);

    expect([...prepared.scanRequest.changedPackages!].sort()).toEqual(
      [...expected.changedPackages].sort(),
    );
    expect(prepared.scanRequest.lockfilePackageDelta).toEqual(
      expected.lockfilePackageDelta,
    );
    expect(prepared.preparationSummary.codeAnalysisEnabled).toBe(
      expected.codeAnalysisEnabled,
    );
    expect(prepared.preparationSummary.warningCodes.sort()).toEqual(
      expected.warningCodes.sort(),
    );
  });

  it("matches PR #28 typescript patch with code fetch enabled (mocked GitHub)", async () => {
    const fetchSpy = vi
      .spyOn(githubFiles, "fetchGitHubFiles")
      .mockResolvedValue({
        files: new Map([["src/index.ts", "export {}"]]),
        sourceFilesSkipped: 0,
      });

    try {
      const job = loadJson<ScanQueueJob>("pr-typescript-patch.job.json");
      const expected = loadJson<{
        changedPackages: string[];
        lockfilePackageDelta: {
          added: string[];
          removed: string[];
          updated: string[];
        };
        warningCodes: string[];
        codeAnalysisEnabled: boolean;
      }>("pr-typescript-patch.prep.json");

      const prepared = await prepareScanContext(job);

      expect([...prepared.scanRequest.changedPackages!].sort()).toEqual(
        [...expected.changedPackages].sort(),
      );
      expect(prepared.scanRequest.lockfilePackageDelta).toEqual(
        expected.lockfilePackageDelta,
      );
      expect(prepared.preparationSummary.codeAnalysisEnabled).toBe(
        expected.codeAnalysisEnabled,
      );
      expect(prepared.preparationSummary.changedPackageCount).toBeGreaterThan(
        0,
      );
      expect(prepared.codeAnalysis?.fileContents.size).toBeGreaterThan(0);
      expect(prepared.preparationSummary.warningCodes).not.toContain(
        "lockfile_diff_empty",
      );
      expect(prepared.preparationSummary.warningCodes).not.toContain(
        "code_fetch_skipped",
      );
      expect(prepared.preparationSummary.warningCodes.sort()).toEqual(
        expected.warningCodes.sort(),
      );
      expect(fetchSpy).toHaveBeenCalledOnce();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
