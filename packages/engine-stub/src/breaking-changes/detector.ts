import type { BreakingChange } from "@mergesignal/shared";
import { analyzeSemverBreakingChanges } from "./semver-analyzer.js";
import { parseBreakingChanges, fetchChangelog } from "./changelog-parser.js";
import { breakingChangeCache } from "./sources/cache.js";
import { createFallbackWarning, handleNotFound, handleNetworkError, type BreakingChangeError } from "./sources/fallbacks.js";

/**
 * Main breaking change detection orchestrator.
 * 
 * Coordinates multiple detection strategies:
 * 1. Check cache first (avoid redundant API calls)
 * 2. Semver heuristics (instant, free)
 * 3. Changelog parsing (cached, ~80% coverage)
 * 4. Future: Breaking change DB lookup
 * 
 * Implements the detection flow from the architecture plan.
 */

export type UpgradeInfo = {
  name: string;
  fromVersion: string;
  toVersion: string;
};

export type DetectionOptions = {
  /**
   * Skip changelog fetching (useful for free tier or testing)
   */
  skipChangelog?: boolean;
  
  /**
   * Skip cache lookup (force fresh detection)
   */
  skipCache?: boolean;
  
  /**
   * Maximum time to wait for external sources (ms)
   */
  timeoutMs?: number;
};

/**
 * Detect breaking changes for a package upgrade.
 * 
 * @param upgrade - Package upgrade information (name, from/to versions)
 * @param options - Detection options (caching, timeout, etc.)
 * @returns Array of detected breaking changes
 */
export async function detectBreakingChanges(
  upgrade: UpgradeInfo,
  options: DetectionOptions = {}
): Promise<BreakingChange[]> {
  const changes: BreakingChange[] = [];
  const errors: BreakingChangeError[] = [];
  
  // 1. Check cache first (unless explicitly skipped)
  if (!options.skipCache) {
    const cached = breakingChangeCache.get({
      packageName: upgrade.name,
      fromVersion: upgrade.fromVersion,
      toVersion: upgrade.toVersion,
    });
    
    if (cached) {
      return cached;
    }
  }
  
  // 2. Semver heuristics (instant, always available)
  const semverChanges = analyzeSemverBreakingChanges(
    upgrade.name,
    upgrade.fromVersion,
    upgrade.toVersion
  );
  changes.push(...semverChanges);
  
  // 3. Changelog parsing (if not skipped)
  if (!options.skipChangelog) {
    try {
      const changelog = await withTimeout(
        fetchChangelog(upgrade.name, upgrade.toVersion),
        options.timeoutMs ?? 5000
      );
      
      if (changelog) {
        const changelogChanges = parseBreakingChanges(changelog);
        changes.push(...changelogChanges);
      } else {
        // Not found is not an error - many packages don't have changelogs
        const notFoundResult = handleNotFound(`changelog for ${upgrade.name}@${upgrade.toVersion}`);
        if (!notFoundResult.success && notFoundResult.error) {
          errors.push(notFoundResult.error);
        }
      }
    } catch (error) {
      const networkResult = handleNetworkError(error, 1, 1); // Single attempt for MVP
      if (!networkResult.success) {
        errors.push(networkResult.error);
        if (networkResult.fallback) {
          changes.push(...networkResult.fallback);
        }
      }
    }
  }
  
  // 4. Future: Breaking change DB lookup
  // const knownChanges = await queryBreakingChangeDB(upgrade);
  // changes.push(...knownChanges);
  
  // 5. If all sources failed and we have no changes, add fallback warning
  if (changes.length === 0 && errors.length > 0) {
    changes.push(
      createFallbackWarning(upgrade.name, upgrade.fromVersion, upgrade.toVersion, errors)
    );
  }
  
  // 6. Cache the results (even if empty - avoid redundant fetches)
  if (!options.skipCache && changes.length > 0) {
    const source = changes.some(c => c.source === 'changelog') ? 'changelog' : 'semver';
    breakingChangeCache.set(
      {
        packageName: upgrade.name,
        fromVersion: upgrade.fromVersion,
        toVersion: upgrade.toVersion,
      },
      changes,
      source
    );
  }
  
  return deduplicateChanges(changes);
}

/**
 * Detect breaking changes for multiple package upgrades.
 * Processes in parallel for better performance.
 */
export async function detectBreakingChangesForUpgrades(
  upgrades: UpgradeInfo[],
  options: DetectionOptions = {}
): Promise<Map<string, BreakingChange[]>> {
  const results = await Promise.all(
    upgrades.map(async (upgrade) => {
      const changes = await detectBreakingChanges(upgrade, options);
      return { package: upgrade.name, changes } as const;
    })
  );
  
  const map = new Map<string, BreakingChange[]>();
  for (const { package: pkg, changes } of results) {
    map.set(pkg, changes);
  }
  
  return map;
}

/**
 * Remove duplicate breaking changes (same description and severity).
 * Prioritizes changelog sources over semver heuristics.
 */
function deduplicateChanges(changes: BreakingChange[]): BreakingChange[] {
  const seen = new Map<string, BreakingChange>();
  
  // Sort to prioritize changelog > manual > semver
  const sorted = [...changes].sort((a, b) => {
    const priority = { changelog: 0, manual: 1, semver: 2 };
    return priority[a.source] - priority[b.source];
  });
  
  for (const change of sorted) {
    const key = `${change.description}:${change.severity}`;
    if (!seen.has(key)) {
      seen.set(key, change);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Wrap a promise with a timeout.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}
