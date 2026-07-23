#!/usr/bin/env tsx
/**
 * Fail-closed npmjs version availability check for @mergesignal/scan-prep publication.
 */
import { classifyNpmjsScanPrepVersionAvailability } from "./lib/scan-prep-npmjs-version-availability.ts";
import { PACKAGE_NAME } from "./lib/scan-prep-pack-artifact.ts";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function parseVersion(argv: string[]): string {
  const flag = argv.find((arg) => arg.startsWith("--version="));
  const version = flag?.split("=")[1]?.trim();
  if (!version) {
    throw new Error("Version required: --version=X.Y.Z");
  }
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`Invalid version: ${version}`);
  }
  return version;
}

function main(): void {
  const version = parseVersion(process.argv.slice(2));
  const result = classifyNpmjsScanPrepVersionAvailability(version);

  if (result.kind === "published") {
    throw new Error(
      `${PACKAGE_NAME}@${version} is already published on npmjs (reported version: ${result.version})`,
    );
  }

  if (result.kind === "not_found") {
    process.stdout.write(
      `check:scan-prep-npmjs-version-availability OK (${PACKAGE_NAME}@${version} not on npmjs)\n`,
    );
    return;
  }

  throw new Error(
    `version availability for ${PACKAGE_NAME}@${version} could not be proven: ${result.message}`,
  );
}

main();
