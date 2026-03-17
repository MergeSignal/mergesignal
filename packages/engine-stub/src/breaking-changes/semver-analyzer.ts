import type { BreakingChange } from "@mergesignal/shared";

/**
 * Semver-based breaking change detection.
 * 
 * Uses semantic versioning heuristics to identify potential breaking changes:
 * - Major version bumps (1.x.x → 2.0.0) = likely breaking
 * - Pre-1.0 minor bumps (0.x.y → 0.y.0 where y > x) = may be breaking
 */

export type SemverVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
};

/**
 * Parse a version string into structured semver components.
 * Handles common formats: "1.2.3", "v1.2.3", "1.2.3-beta.1", "^1.2.3", "~1.2.3"
 */
export function parseSemver(version: string): SemverVersion | null {
  // Strip common prefixes and range operators
  const cleaned = version.replace(/^[\^~>=<v]+ */, '');
  
  // Match semver pattern: major.minor.patch[-prerelease]
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  
  if (!match) {
    return null;
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
  };
}

/**
 * Check if a version bump represents a major version upgrade.
 * Returns true for bumps like 1.x.x → 2.0.0
 */
export function isMajorBump(fromVersion: string, toVersion: string): boolean {
  const from = parseSemver(fromVersion);
  const to = parseSemver(toVersion);
  
  if (!from || !to) {
    return false;
  }
  
  return to.major > from.major;
}

/**
 * Check if a pre-1.0 version bump represents a potentially breaking change.
 * For 0.x.y versions, a minor bump (0.x → 0.y where y > x) is treated as breaking.
 */
export function isPreOneBump(fromVersion: string, toVersion: string): boolean {
  const from = parseSemver(fromVersion);
  const to = parseSemver(toVersion);
  
  if (!from || !to) {
    return false;
  }
  
  // Only applies to 0.x.y versions
  if (from.major !== 0 || to.major !== 0) {
    return false;
  }
  
  return to.minor > from.minor;
}

/**
 * Analyze version bump using semver heuristics.
 * Returns breaking change signals based on version changes.
 */
export function analyzeSemverBreakingChanges(
  packageName: string,
  fromVersion: string,
  toVersion: string
): BreakingChange[] {
  const changes: BreakingChange[] = [];
  
  if (isMajorBump(fromVersion, toVersion)) {
    changes.push({
      source: 'semver',
      severity: 'high',
      description: `Major version upgrade detected (${fromVersion} → ${toVersion}). Major bumps typically indicate breaking changes.`,
      affectedAPIs: undefined,
    });
  } else if (isPreOneBump(fromVersion, toVersion)) {
    changes.push({
      source: 'semver',
      severity: 'medium',
      description: `Pre-1.0 minor version bump (${fromVersion} → ${toVersion}). In 0.x versions, minor bumps may contain breaking changes.`,
      affectedAPIs: undefined,
    });
  }
  
  return changes;
}
