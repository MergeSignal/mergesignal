#!/usr/bin/env tsx
/**
 * Pack @mergesignal/scan-prep and validate public npmjs publication hygiene.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import {
  assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority,
  packScanPrepToDirectory,
  readSourcePackageJsonRaw,
  validatePackedScanPrepArtifact,
} from "./lib/scan-prep-pack-artifact.ts";

async function main(): Promise<void> {
  await assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority();
  const sourceBefore = readSourcePackageJsonRaw();
  const packDir = mkdtempSync(`${tmpdir()}/ms-scan-prep-pack-check-`);

  try {
    const packed = packScanPrepToDirectory(packDir);
    const violations = validatePackedScanPrepArtifact({
      tarballPath: packed.tarballPath,
      tarballName: packed.tarballName,
      version: packed.version,
      files: packed.files,
      manifest: packed.manifest,
      sourceManifestBefore: sourceBefore,
    });

    if (violations.length > 0) {
      throw new Error(violations.map((v) => `  - ${v}`).join("\n"));
    }

    process.stdout.write(
      `check:scan-prep-pack-artifact OK (@mergesignal/scan-prep@${packed.version})\n`,
    );
  } finally {
    rmSync(packDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error ?? "unknown error");
  console.error(message);
  process.exitCode = 1;
});
