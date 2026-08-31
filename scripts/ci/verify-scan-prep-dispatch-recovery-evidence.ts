#!/usr/bin/env tsx
/**
 * Verify immutable public evidence for dispatch-only Scan Preparation recovery.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readScanPrepReleaseCoreIdentity } from "./lib/scan-prep-release-identity.ts";
import { assertExactSemver } from "./lib/scan-prep-engine-dispatch.ts";

function parseVersion(argv: string[]): string {
  const flag = argv.find((arg) => arg.startsWith("--version="));
  const version = flag?.split("=")[1]?.trim();
  if (!version) {
    throw new Error("Required: --version=X.Y.Z");
  }
  return assertExactSemver(version);
}

export type ScanPrepRecoveryEvidenceDeps = {
  run?: (command: string, cwd?: string) => string;
};

export function verifyScanPrepDispatchRecoveryEvidence(
  versionInput: string,
  deps: ScanPrepRecoveryEvidenceDeps = {},
): { version: string; tag: string; commitSha: string } {
  const identity = readScanPrepReleaseCoreIdentity(versionInput, deps);
  return {
    version: identity.version,
    tag: identity.tag,
    commitSha: identity.commitSha,
  };
}

function main(): void {
  const version = parseVersion(process.argv.slice(2));
  const evidence = verifyScanPrepDispatchRecoveryEvidence(version);
  console.log(
    `verify:scan-prep-dispatch-recovery-evidence OK (${evidence.tag} @ ${evidence.commitSha})`,
  );
}

const isDirectRun =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
