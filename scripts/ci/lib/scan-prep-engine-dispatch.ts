/**
 * Governed repository_dispatch payload for @mergesignal/scan-prep releases.
 */
import { execSync } from "node:child_process";

export const SCAN_PREP_PACKAGE_NAME = "@mergesignal/scan-prep" as const;
export const SCAN_PREP_RELEASE_EVENT_TYPE =
  "scan-prep-package-released" as const;
const SCAN_PREP_TAG_PREFIX = "scan-prep-v" as const;

const EXACT_SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/;

type ScanPrepReleaseDispatchPayload = {
  package: typeof SCAN_PREP_PACKAGE_NAME;
  version: string;
  tag: string;
  commit_sha: string;
};

export function assertExactSemver(version: string, label = "version"): string {
  const trimmed = version.trim();
  if (!EXACT_SEMVER_PATTERN.test(trimmed)) {
    throw new Error(`${label} must be exact semver (got "${version}")`);
  }
  if (
    trimmed.includes("latest") ||
    trimmed.startsWith("^") ||
    trimmed.startsWith("~")
  ) {
    throw new Error(`${label} must be exact semver (got "${version}")`);
  }
  return trimmed;
}

export function releaseTagForVersion(version: string): string {
  const exactVersion = assertExactSemver(version);
  return `${SCAN_PREP_TAG_PREFIX}${exactVersion}`;
}

function assertReleaseTagForVersion(tag: string, version: string): string {
  const expected = releaseTagForVersion(version);
  if (tag !== expected) {
    throw new Error(`tag must be ${expected} (got "${tag}")`);
  }
  return tag;
}

export function assertFullCommitSha(commitSha: string): string {
  const trimmed = commitSha.trim().toLowerCase();
  if (!FULL_SHA_PATTERN.test(trimmed)) {
    throw new Error(
      `commit_sha must be a full 40-character git SHA (got "${commitSha}")`,
    );
  }
  return trimmed;
}

export function buildScanPrepReleaseDispatchPayload(options: {
  version: string;
  tag: string;
  commitSha: string;
}): ScanPrepReleaseDispatchPayload {
  const version = assertExactSemver(options.version);
  const tag = assertReleaseTagForVersion(options.tag, version);
  const commit_sha = assertFullCommitSha(options.commitSha);
  return {
    package: SCAN_PREP_PACKAGE_NAME,
    version,
    tag,
    commit_sha,
  };
}

export function dispatchScanPrepPackageReleased(options: {
  version: string;
  tag: string;
  commitSha: string;
  engineRepo: string;
  ghToken: string;
  cwd?: string;
}): void {
  const payload = buildScanPrepReleaseDispatchPayload({
    version: options.version,
    tag: options.tag,
    commitSha: options.commitSha,
  });
  if (!options.ghToken.trim()) {
    throw new Error("MERGESIGNAL_ENGINE_DISPATCH_TOKEN is not set");
  }
  const engineRepo =
    options.engineRepo.trim() || "MergeSignal/mergesignal-engine";
  if (!/^[^/\s]+\/[^/\s]+$/.test(engineRepo)) {
    throw new Error(`invalid engine repository: ${engineRepo}`);
  }

  execSync(
    [
      "gh api --method POST",
      '-H "Accept: application/vnd.github+json"',
      `"/repos/${engineRepo}/dispatches"`,
      `-f event_type='${SCAN_PREP_RELEASE_EVENT_TYPE}'`,
      `-f "client_payload[package]=${payload.package}"`,
      `-f "client_payload[version]=${payload.version}"`,
      `-f "client_payload[tag]=${payload.tag}"`,
      `-f "client_payload[commit_sha]=${payload.commit_sha}"`,
    ].join(" "),
    {
      cwd: options.cwd ?? process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GH_TOKEN: options.ghToken,
      },
    },
  );
}
