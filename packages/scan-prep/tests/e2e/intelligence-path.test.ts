import { describe, expect, it, beforeEach } from "vitest";
import type { ScanQueueJob } from "@mergesignal/shared";
import { prepareScanContext } from "../../src/prepareScanContext.js";

const scenarios: Array<{
  name: string;
  headPkg: string;
  headVersion: string;
  baseVersion: string;
}> = [
  {
    name: "authentication",
    headPkg: "jsonwebtoken",
    headVersion: "9.0.0",
    baseVersion: "8.5.0",
  },
  {
    name: "runtime framework",
    headPkg: "react",
    headVersion: "18.2.0",
    baseVersion: "17.0.2",
  },
  {
    name: "build-only",
    headPkg: "typescript",
    headVersion: "5.4.0",
    baseVersion: "5.3.0",
  },
  {
    name: "test-only",
    headPkg: "vitest",
    headVersion: "2.0.0",
    baseVersion: "1.6.0",
  },
  {
    name: "utility",
    headPkg: "lodash",
    headVersion: "4.17.21",
    baseVersion: "4.17.20",
  },
];

function pnpmLock(packages: Array<{ name: string; version: string }>): string {
  const pkgLines = packages
    .map(
      (p) => `  ${p.name}@${p.version}:\n    resolution: {integrity: sha512-x}`,
    )
    .join("\n");
  return `lockfileVersion: '9.0'\npackages:\n${pkgLines}\n`;
}

describe("e2e prepareScanContext lockfile scenarios", () => {
  beforeEach(() => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_PRIVATE_KEY;
  });

  for (const scenario of scenarios) {
    it(`detects changed package: ${scenario.name}`, async () => {
      const job: ScanQueueJob = {
        scanId: `e2e-${scenario.name}`,
        repoId: "acme/app",
        dependencyGraph: {},
        lockfile: {
          manager: "pnpm",
          content: pnpmLock([
            { name: scenario.headPkg, version: scenario.headVersion },
          ]),
        },
        baseLockfile: {
          manager: "pnpm",
          content: pnpmLock([
            { name: scenario.headPkg, version: scenario.baseVersion },
          ]),
        },
      };

      const prepared = await prepareScanContext(job);
      expect(prepared.scanRequest.changedPackages).toContain(scenario.headPkg);
      expect(prepared.scanRequest.lockfilePackageDelta?.updated).toContain(
        scenario.headPkg,
      );
    });
  }
});
