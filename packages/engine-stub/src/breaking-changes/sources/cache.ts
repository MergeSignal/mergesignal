import type { BreakingChange } from "@mergesignal/shared";

/**
 * In-memory cache for breaking change metadata.
 * 
 * In production, this should be replaced with:
 * - PostgreSQL table (breaking_change_cache as per plan)
 * - Redis for faster access
 * - TTL-based expiration (30 days for breaking changes)
 */

export type CacheKey = {
  packageName: string;
  fromVersion: string;
  toVersion: string;
};

export type CacheEntry = {
  changes: BreakingChange[];
  source: 'changelog' | 'semver' | 'manual';
  fetchedAt: Date;
  expiresAt: Date;
};

/**
 * Simple in-memory cache implementation.
 * For MVP only - replace with persistent storage for production.
 */
class BreakingChangeCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  /**
   * Generate cache key from package name and version range.
   */
  private getCacheKey(key: CacheKey): string {
    return `${key.packageName}:${key.fromVersion}→${key.toVersion}`;
  }
  
  /**
   * Get cached breaking changes if available and not expired.
   */
  get(key: CacheKey): BreakingChange[] | null {
    const cacheKey = this.getCacheKey(key);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (entry.expiresAt < new Date()) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return entry.changes;
  }
  
  /**
   * Store breaking changes in cache with TTL.
   */
  set(
    key: CacheKey,
    changes: BreakingChange[],
    source: CacheEntry['source'],
    ttlMs?: number
  ): void {
    const cacheKey = this.getCacheKey(key);
    const now = new Date();
    const ttl = ttlMs ?? this.DEFAULT_TTL_MS;
    
    this.cache.set(cacheKey, {
      changes,
      source,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + ttl),
    });
  }
  
  /**
   * Clear expired entries from cache.
   * Should be called periodically (e.g., daily cron job).
   */
  cleanup(): number {
    const now = new Date();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    return removed;
  }
  
  /**
   * Clear all cache entries (useful for testing).
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics.
   */
  stats(): { size: number; expired: number } {
    const now = new Date();
    let expired = 0;
    
    for (const entry of this.cache.values()) {
      if (entry.expiresAt < now) {
        expired++;
      }
    }
    
    return {
      size: this.cache.size,
      expired,
    };
  }
}

/**
 * Singleton cache instance.
 */
export const breakingChangeCache = new BreakingChangeCache();

/**
 * PostgreSQL schema for production cache (reference only).
 * 
 * This should be implemented as a migration when moving to production:
 * 
 * ```sql
 * CREATE TABLE breaking_change_cache (
 *   package_name TEXT NOT NULL,
 *   from_version TEXT NOT NULL,
 *   to_version TEXT NOT NULL,
 *   changes JSONB NOT NULL,
 *   source TEXT NOT NULL, -- 'changelog' | 'semver' | 'manual'
 *   fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
 *   PRIMARY KEY (package_name, from_version, to_version)
 * );
 * 
 * CREATE INDEX breaking_change_expires_idx ON breaking_change_cache(expires_at);
 * ```
 */
