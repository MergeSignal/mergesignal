#!/usr/bin/env tsx
/**
 * Isolated install smoke for unpublished @mergesignal/scan-prep release candidate.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  PACKAGE_NAME,
  assertPackedScanPrepArtifactValid,
  assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority,
  loadScanPrepCandidateFromTarball,
  packScanPrepToDirectory,
  parseCandidateArg,
  readSourcePackageJsonRaw,
} from "./lib/scan-prep-pack-artifact.ts";
import { runScanPrepIsolatedInstall } from "./lib/scan-prep-isolated-install.ts";
import { readSharedReleaseVersion } from "./lib/shared-package-version.ts";

function main(): void {
  assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority();
  const expectedSharedVersion = readSharedReleaseVersion();
  const candidatePath = parseCandidateArg(process.argv.slice(2));
  let packDir: string | undefined;
  let removePackDir = false;

  const candidate = candidatePath
    ? loadScanPrepCandidateFromTarball(candidatePath)
    : (() => {
        packDir = mkdtempSync(
          path.join(tmpdir(), "ms-scan-prep-isolated-pack-"),
        );
        removePackDir = true;
        return packScanPrepToDirectory(packDir);
      })();

  try {
    if (candidatePath) {
      assertPackedScanPrepArtifactValid(candidate, readSourcePackageJsonRaw());
    }

    runScanPrepIsolatedInstall({ candidate });
    process.stdout.write(
      `check:scan-prep-isolated-install OK (${PACKAGE_NAME}@${candidate.version} candidate + @mergesignal/shared@${expectedSharedVersion} from npmjs)\n`,
    );
  } finally {
    if (removePackDir && packDir) {
      rmSync(packDir, { recursive: true, force: true });
    }
  }
}

main();
