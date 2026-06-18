import type { ScanQueueJob } from "@mergesignal/shared";
import { describe, expect, it } from "vitest";

import { prepareScanContext } from "../src/prepareScanContext.js";

const pnpmLock = (
  packages: Array<{ name: string; version: string }>,
): string => {
  const pkgLines = packages
    .map(
      (p) => `  ${p.name}@${p.version}:\n    resolution: {integrity: sha512-x}`,
    )
    .join("\n");
  return `lockfileVersion: '9.0'\npackages:\n${pkgLines}\n`;
};

describe("prepareScanContext baseLockfile forwarding", () => {
  it("forwards baseLockfile on scanRequest for analyze()", async () => {
    const job: ScanQueueJob = {
      scanId: "forward-base",
      repoId: "MergeSignal/mergesignal",
      dependencyGraph: {},
      lockfile: {
        manager: "pnpm",
        content: pnpmLock([{ name: "fastify", version: "5.0.0" }]),
      },
      baseLockfile: {
        manager: "pnpm",
        content: pnpmLock([{ name: "fastify", version: "4.18.0" }]),
      },
    };

    const prepared = await prepareScanContext(job);

    expect(prepared.scanRequest.baseLockfile).toEqual(job.baseLockfile);
    expect(prepared.scanRequest.lockfile).toEqual(job.lockfile);
    expect(prepared.scanRequest.changedPackages).toContain("fastify");
    expect(prepared.scanRequest.lockfilePackageDelta?.updated).toContain(
      "fastify",
    );
  });
});
