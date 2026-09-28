/**
 * Change-request (PR) changed-path filtering — distinct from full-tree corpus policy.
 * Excludes test fixtures and declaration-only paths that tree glob matching may still include.
 */

import { normalizeRepositoryRelativePath } from "./corpusPolicy.js";

const CHANGE_REQUEST_SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);

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
  const normalized = normalizeRepositoryRelativePath(path);
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const ext = normalized.substring(dotIndex);
  if (!CHANGE_REQUEST_SOURCE_EXTENSIONS.has(ext)) return false;

  for (const pattern of CHANGE_REQUEST_IGNORED_PATH_PATTERNS) {
    if (pattern.test(normalized)) return false;
  }
  return true;
}

export function filterChangeRequestChangedSourcePaths(
  changedFiles: readonly string[],
): string[] {
  return changedFiles.filter(isChangeRequestChangedSourcePathEligible);
}
