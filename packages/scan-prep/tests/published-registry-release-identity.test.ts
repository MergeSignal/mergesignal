import { execSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SCAN_PREP_PACKAGE_NAME } from "../../../scripts/ci/lib/scan-prep-engine-dispatch.ts";
import { readScanPrepReleaseIdentity } from "../../../scripts/ci/lib/scan-prep-release-identity.ts";
import { readSharedReleaseVersion } from "../../../scripts/ci/lib/shared-package-version.ts";

function runInRepository(repoDir: string, command: string): string {
  return execSync(command, {
    cwd: repoDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function initHermeticRepository(tempPrefix: string): string {
  const repoDir = mkdtempSync(path.join(tmpdir(), tempPrefix));
  runInRepository(repoDir, "git init");
  runInRepository(repoDir, 'git config user.email "scan-prep@test.local"');
  runInRepository(
    repoDir,
    'git config user.name "Scan Prep Release Identity Test"',
  );
  return repoDir;
}

function writeScanPrepPackageManifest(
  repoDir: string,
  version: string,
  sharedDependencyVersion: string,
): void {
  const packageDir = path.join(repoDir, "packages/scan-prep");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: SCAN_PREP_PACKAGE_NAME,
        version,
        dependencies: {
          "@mergesignal/shared": sharedDependencyVersion,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function commitScanPrepRelease(
  repoDir: string,
  version: string,
  sharedDependencyVersion: string,
  commitMessage: string,
): string {
  writeScanPrepPackageManifest(repoDir, version, sharedDependencyVersion);
  runInRepository(repoDir, "git add .");
  runInRepository(repoDir, `git commit -m ${JSON.stringify(commitMessage)}`);
  return runInRepository(repoDir, "git rev-parse HEAD");
}

function tagAnnotatedRelease(repoDir: string, version: string): void {
  runInRepository(
    repoDir,
    `git tag -a scan-prep-v${version} -m ${JSON.stringify(`scan-prep ${version}`)}`,
  );
}

function tagLightweightRelease(repoDir: string, version: string): void {
  runInRepository(repoDir, `git tag scan-prep-v${version}`);
}

function readReleaseIdentityInRepository(
  repoDir: string,
  version: string,
): ReturnType<typeof readScanPrepReleaseIdentity> {
  return readScanPrepReleaseIdentity(version, {
    run: (command) => runInRepository(repoDir, command),
  });
}

describe("published-registry release identity", () => {
  it("reads expected Shared dependency from immutable scan-prep release tag", () => {
    const { repoDir, releaseCommitSha } = (() => {
      const repoDir = initHermeticRepository("scan-prep-release-identity-");
      const releaseCommitSha = commitScanPrepRelease(
        repoDir,
        "0.1.4",
        "0.17.0",
        "release scan-prep 0.1.4",
      );
      tagAnnotatedRelease(repoDir, "0.1.4");
      return { repoDir, releaseCommitSha };
    })();

    try {
      const identity = readReleaseIdentityInRepository(repoDir, "0.1.4");
      expect(identity).toEqual({
        version: "0.1.4",
        tag: "scan-prep-v0.1.4",
        commitSha: releaseCommitSha,
        sharedDependencyVersion: "0.17.0",
      });
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("keeps historical Shared dependency when workspace has advanced", () => {
    const { repoDir, releaseCommitSha } = (() => {
      const repoDir = initHermeticRepository("scan-prep-historical-identity-");
      const releaseCommitSha = commitScanPrepRelease(
        repoDir,
        "0.1.4",
        "0.17.0",
        "release scan-prep 0.1.4",
      );
      tagAnnotatedRelease(repoDir, "0.1.4");
      commitScanPrepRelease(
        repoDir,
        "0.1.5",
        "0.18.0",
        "advance workspace scan-prep and Shared dependency",
      );
      return { repoDir, releaseCommitSha };
    })();

    try {
      const historicalIdentity = readReleaseIdentityInRepository(
        repoDir,
        "0.1.4",
      );
      const workspaceManifest = JSON.parse(
        readFileSync(
          path.join(repoDir, "packages/scan-prep/package.json"),
          "utf8",
        ),
      ) as { version: string; dependencies: Record<string, string> };

      expect(workspaceManifest.version).toBe("0.1.5");
      expect(workspaceManifest.dependencies["@mergesignal/shared"]).toBe(
        "0.18.0",
      );
      expect(historicalIdentity.commitSha).toBe(releaseCommitSha);
      expect(historicalIdentity.sharedDependencyVersion).toBe("0.17.0");
      expect(historicalIdentity.sharedDependencyVersion).not.toBe(
        workspaceManifest.dependencies["@mergesignal/shared"],
      );
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("does not derive historical Shared dependency from current Shared HEAD", () => {
    const repoDir = initHermeticRepository("scan-prep-head-boundary-");
    const currentSharedHead = readSharedReleaseVersion();
    const historicalShared =
      currentSharedHead === "0.17.0" ? "0.16.0" : "0.17.0";

    try {
      const releaseCommitSha = commitScanPrepRelease(
        repoDir,
        "9.9.9",
        historicalShared,
        "historical release for temporal boundary test",
      );
      tagAnnotatedRelease(repoDir, "9.9.9");
      commitScanPrepRelease(
        repoDir,
        "9.9.10",
        currentSharedHead,
        "advance workspace Shared dependency",
      );

      const identity = readReleaseIdentityInRepository(repoDir, "9.9.9");
      expect(identity.sharedDependencyVersion).toBe(historicalShared);
      expect(identity.sharedDependencyVersion).not.toBe(currentSharedHead);
      expect(identity.commitSha).toBe(releaseCommitSha);
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("resolves lightweight release tags to their commit identity", () => {
    const repoDir = initHermeticRepository("scan-prep-lightweight-tag-");
    try {
      const releaseCommitSha = commitScanPrepRelease(
        repoDir,
        "1.2.3",
        "0.17.0",
        "lightweight tag release",
      );
      tagLightweightRelease(repoDir, "1.2.3");

      const identity = readReleaseIdentityInRepository(repoDir, "1.2.3");
      expect(identity.commitSha).toBe(releaseCommitSha);
      expect(identity.sharedDependencyVersion).toBe("0.17.0");
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });
});
