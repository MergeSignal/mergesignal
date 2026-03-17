/**
 * Breaking Change Detection Module
 * 
 * Provides intelligent breaking change detection for dependency upgrades.
 * 
 * ## Usage
 * 
 * ```typescript
 * import { detectBreakingChanges } from './breaking-changes';
 * 
 * const changes = await detectBreakingChanges({
 *   name: 'express',
 *   fromVersion: '4.18.0',
 *   toVersion: '5.0.0',
 * });
 * 
 * console.log(changes);
 * // [
 * //   {
 * //     source: 'semver',
 * //     severity: 'high',
 * //     description: 'Major version upgrade detected (4.18.0 → 5.0.0)...',
 * //   }
 * // ]
 * ```
 * 
 * ## Architecture
 * 
 * - `detector.ts`: Main orchestrator for breaking change detection
 * - `semver-analyzer.ts`: Version-based heuristics (instant, free)
 * - `changelog-parser.ts`: Changelog parsing (cached, high coverage)
 * - `sources/cache.ts`: In-memory cache (30-day TTL)
 * - `sources/fallbacks.ts`: Graceful error handling
 */

export {
  detectBreakingChanges,
  detectBreakingChangesForUpgrades,
  type UpgradeInfo,
  type DetectionOptions,
} from './detector.js';

export {
  analyzeSemverBreakingChanges,
  isMajorBump,
  isPreOneBump,
  parseSemver,
  type SemverVersion,
} from './semver-analyzer.js';

export {
  parseBreakingChanges,
  extractAffectedAPIs,
  fetchChangelog,
} from './changelog-parser.js';

export {
  breakingChangeCache,
  type CacheKey,
  type CacheEntry,
} from './sources/cache.js';

export {
  createFallbackWarning,
  handleRateLimit,
  handleNetworkError,
  handleNotFound,
  handleParseError,
  shouldRetry,
  getRetryDelay,
  type BreakingChangeError,
  type BreakingChangeResult,
} from './sources/fallbacks.js';
