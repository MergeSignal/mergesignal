/**
 * Immutable scan-prep release identity from tag-backed git metadata.
 * Owns: scan-prep-v<version> → packages/scan-prep/package.json at tagged commit.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCAN_PREP_PACKAGE_NAME,
  assertExactSemver,
  assertFullCommitSha,
  releaseTagForVersion,
} from "./scan-prep-engine-dispatch.ts";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const SCAN_PREP_PACKAGE_JSON_PATH = path.posix.join(
  "packages/scan-prep/package.json",
);

type ScanPrepReleaseIdentityRun = (command: string, cwd?: string) => string;

type ScanPrepPackageManifestAtCommit = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
};

function defaultRun(command: string, cwd = REPO_ROOT): string {
  return execSync(command, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function resolveTagCommitSha(
  tag: string,
  runFn: ScanPrepReleaseIdentityRun,
): string {
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

function assertReleaseTagExists(
  tag: string,
  runFn: ScanPrepReleaseIdentityRun,
): void {
  try {
    runFn(`git rev-parse --verify ${JSON.stringify(tag)}`);
  } catch {
    throw new Error(`release tag not found: ${tag}`);
  }
  const objectType = runFn(`git cat-file -t ${JSON.stringify(tag)}`);
  if (objectType !== "tag" && objectType !== "commit") {
    throw new Error(`release tag not found: ${tag}`);
  }
}

function readScanPrepPackageManifestAtCommit(
  commitSha: string,
  runFn: ScanPrepReleaseIdentityRun,
): ScanPrepPackageManifestAtCommit {
  const raw = runFn(`git show ${commitSha}:${SCAN_PREP_PACKAGE_JSON_PATH}`);
  const parsed = JSON.parse(raw) as {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
  };
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
    dependencies: parsed.dependencies,
  };
}

function readSharedDependencyFromScanPrepManifest(
  manifest: Pick<ScanPrepPackageManifestAtCommit, "dependencies">,
  label: string,
): string {
  const sharedDep = manifest.dependencies?.["@mergesignal/shared"];
  if (typeof sharedDep !== "string" || !sharedDep.trim()) {
    throw new Error(
      `${label} must declare an exact @mergesignal/shared dependency`,
    );
  }
  return assertExactSemver(
    sharedDep,
    "@mergesignal/shared dependency at release tag",
  );
}

export function readScanPrepReleaseCoreIdentity(
  versionInput: string,
  deps: { run?: ScanPrepReleaseIdentityRun } = {},
): { version: string; tag: string; commitSha: string } {
  const version = assertExactSemver(versionInput);
  const tag = releaseTagForVersion(version);
  const runFn = deps.run ?? defaultRun;
  assertReleaseTagExists(tag, runFn);
  const commitSha = resolveTagCommitSha(tag, runFn);
  const manifest = readScanPrepPackageManifestAtCommit(commitSha, runFn);
  if (manifest.version !== version) {
    throw new Error(
      `tag ${tag} commit package version (${manifest.version}) must match requested version (${version})`,
    );
  }
  return { version, tag, commitSha };
}

export function readScanPrepReleaseIdentity(
  versionInput: string,
  deps: { run?: ScanPrepReleaseIdentityRun } = {},
): {
  version: string;
  tag: string;
  commitSha: string;
  sharedDependencyVersion: string;
} {
  const runFn = deps.run ?? defaultRun;
  const core = readScanPrepReleaseCoreIdentity(versionInput, deps);
  const manifest = readScanPrepPackageManifestAtCommit(core.commitSha, runFn);
  const sharedDependencyVersion = readSharedDependencyFromScanPrepManifest(
    manifest,
    `packages/scan-prep/package.json at ${core.tag}`,
  );
  return { ...core, sharedDependencyVersion };
}
