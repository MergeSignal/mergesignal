import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ScanQueueJob } from "@mergesignal/shared";
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
});
