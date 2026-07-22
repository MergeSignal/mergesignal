import type { RepoSource } from "@mergesignal/shared";

import { logDebug, logInfo } from "./log.js";

interface CachedFiles {
  files: Map<string, string>;
  fetchedAt: Date;
  metrics: {
    fileCount: number;
    totalBytes: number;
    fetchTimeMs: number;
  };
}

const cache = new Map<string, CachedFiles>();

function cacheTtlMs(): number {
  const raw = process.env.CODE_ANALYSIS_CACHE_TTL_MS;
  const n = raw ? Number(raw) : 3_600_000;
  return Number.isFinite(n) && n > 0 ? n : 3_600_000;
}

function getCacheKey(repoSource: RepoSource): string {
  return `${repoSource.owner}/${repoSource.repo}@${repoSource.sha}`;
}

export function getCachedFiles(
  repoSource: RepoSource,
): Map<string, string> | null {
  const key = getCacheKey(repoSource);
  const cached = cache.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.fetchedAt.getTime();
  const ttl = cacheTtlMs();
  if (age > ttl) {
    cache.delete(key);
    logDebug({ key, ageMs: age }, "Cache entry expired");
    return null;
  }

  logDebug(
    { key, fileCount: cached.metrics.fileCount, ageMs: age },
    "Cache hit",
  );
  return cached.files;
}

export function setCachedFiles(
  repoSource: RepoSource,
  files: Map<string, string>,
  metrics: CachedFiles["metrics"],
): void {
  const key = getCacheKey(repoSource);
  cache.set(key, { files, fetchedAt: new Date(), metrics });
  logInfo(
    {
      key,
      fileCount: metrics.fileCount,
      totalBytes: metrics.totalBytes,
      fetchTimeMs: metrics.fetchTimeMs,
    },
    "Cached files",
  );
}
