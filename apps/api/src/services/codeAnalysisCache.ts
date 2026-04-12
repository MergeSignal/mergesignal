import { createHash } from "crypto";
import type { Redis } from "ioredis";

export type CacheKey = {
  repoId: string;
  sha: string;
  files: string[];
};

export type CachedAnalysis = {
  imports: Record<string, string[]>;
  analyzedFiles: string[];
  cachedAt: string;
};

export class CodeAnalysisCache {
  private redis: Redis | null;
  private ttlMs: number;
  private enabled: boolean;

  constructor(redis: Redis | null, ttlMs: number = 24 * 60 * 60 * 1000) {
    this.redis = redis;
    this.ttlMs = ttlMs;
    this.enabled = Boolean(redis);
  }

  private getCacheKey(key: CacheKey): string {
    const filesHash = createHash("sha256").update(key.files.sort().join(",")).digest("hex").slice(0, 16);
    return `code-analysis:${key.repoId}:${key.sha}:${filesHash}`;
  }

  async get(key: CacheKey): Promise<CachedAnalysis | null> {
    if (!this.enabled || !this.redis) return null;

    try {
      const cacheKey = this.getCacheKey(key);
      const value = await this.redis.get(cacheKey);
      if (!value) return null;

      return JSON.parse(value) as CachedAnalysis;
    } catch {
      return null;
    }
  }

  async set(key: CacheKey, value: CachedAnalysis): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const cacheKey = this.getCacheKey(key);
      const ttlSeconds = Math.floor(this.ttlMs / 1000);
      await this.redis.setex(cacheKey, ttlSeconds, JSON.stringify(value));
    } catch {
      // Silently fail cache writes to avoid disrupting the main flow
    }
  }

  async invalidate(repoId: string, sha: string): Promise<void> {
    if (!this.enabled || !this.redis) return;

    try {
      const pattern = `code-analysis:${repoId}:${sha}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // Silently fail cache invalidation
    }
  }
}
