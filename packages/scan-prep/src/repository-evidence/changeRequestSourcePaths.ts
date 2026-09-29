/**
 * Change-request (PR) changed-path filtering — distinct from full-tree corpus policy.
 */

import {
  isCanonicalRepositoryRelativePath,
  terminalRepositorySourceExtension,
} from "./corpusPolicy.js";

const CHANGE_REQUEST_IGNORED_PATH_PATTERNS = [
  /node_modules\//,
  /\.test\./,
  /\.spec\./,
  /\/__tests__\//,
  /^test\//,
  /^tests\//,
  /\/test\//,
  /\/tests\//,
  /\.d\.ts$/,
] as const;

export function isChangeRequestChangedSourcePathEligible(
  path: string,
): boolean {
  if (!isCanonicalRepositoryRelativePath(path)) return false;
  if (terminalRepositorySourceExtension(path) === null) return false;

  for (const pattern of CHANGE_REQUEST_IGNORED_PATH_PATTERNS) {
    if (pattern.test(path)) return false;
  }
  return true;
}

export function filterChangeRequestChangedSourcePaths(
  changedFiles: readonly string[],
): string[] {
  return changedFiles.filter(isChangeRequestChangedSourcePathEligible);
}
