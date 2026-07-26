#!/usr/bin/env tsx
/**
 * Verify immutable public evidence for dispatch-only Scan Preparation recovery.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCAN_PREP_PACKAGE_NAME,
  assertExactSemver,
  assertFullCommitSha,
  releaseTagForVersion,
} from "./lib/scan-prep-engine-dispatch.ts";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function parseVersion(argv: string[]): string {
  const flag = argv.find((arg) => arg.startsWith("--version="));
  const version = flag?.split("=")[1]?.trim();
  if (!version) {
    throw new Error("Required: --version=X.Y.Z");
  }
  return assertExactSemver(version);
}

function run(command: string, cwd = REPO_ROOT): string {
  return runCommand(command, cwd);
}

function runCommand(command: string, cwd = REPO_ROOT): string {
  return execSync(command, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export type ScanPrepRecoveryEvidenceDeps = {
  run?: (command: string, cwd?: string) => string;
};

function resolveTagCommitSha(tag: string, runFn: typeof runCommand): string {
  const objectType = runFn(`git cat-file -t ${JSON.stringify(tag)}`);
  if (objectType === "tag") {
    const peeled = runFn(`git rev-list -n 1 ${JSON.stringify(tag)}`);
    return assertFullCommitSha(peeled);
  }
  if (objectType === "commit") {
    return assertFullCommitSha(
      runFn(`git rev-parse ${JSON.stringify(tag)}^{commit}`),
    );
  }
  throw new Error(`tag ${tag} does not resolve to a commit`);
}

function readPackageMetadataAtCommit(
  commitSha: string,
  runFn: typeof runCommand,
): {
  name: string;
  version: string;
} {
  const raw = runFn(
    `git show ${commitSha}:${path.posix.join("packages/scan-prep/package.json")}`,
  );
  const parsed = JSON.parse(raw) as { name?: string; version?: string };
  if (parsed.name !== SCAN_PREP_PACKAGE_NAME) {
    throw new Error(
      `package name at ${commitSha} must be ${SCAN_PREP_PACKAGE_NAME} (got ${parsed.name ?? "<missing>"})`,
    );
  }
  if (!parsed.version) {
    throw new Error(`package version missing at ${commitSha}`);
  }
  return {
    name: parsed.name,
    version: assertExactSemver(parsed.version, "package version at tag"),
  };
}

function assertTagExists(tag: string, runFn: typeof runCommand): void {
  try {
    runFn(`git rev-parse --verify ${JSON.stringify(tag)}^{tag}`);
  } catch {
    throw new Error(`release tag not found: ${tag}`);
  }
}

export function verifyScanPrepDispatchRecoveryEvidence(
  versionInput: string,
  deps: ScanPrepRecoveryEvidenceDeps = {},
): { version: string; tag: string; commitSha: string } {
  const runFn = deps.run ?? runCommand;
  const version = assertExactSemver(versionInput);
  const tag = releaseTagForVersion(version);
  assertTagExists(tag, runFn);
  const commitSha = resolveTagCommitSha(tag, runFn);
  const metadata = readPackageMetadataAtCommit(commitSha, runFn);
  if (metadata.version !== version) {
    throw new Error(
      `tag ${tag} commit package version (${metadata.version}) must match requested version (${version})`,
    );
  }
  return { version, tag, commitSha };
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
