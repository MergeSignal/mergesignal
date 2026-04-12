import type { RepoSource } from "@mergesignal/shared";
import { CodeAnalysisCache, type CacheKey, type CachedAnalysis } from "./codeAnalysisCache.js";

export type AnalysisResult = {
  imports: Record<string, string[]>;
  analyzedFiles: string[];
  fromCache: boolean;
  analysisTimeMs?: number;
  timedOut?: boolean;
};

export type AnalysisOptions = {
  timeoutMs: number;
  cache: CodeAnalysisCache;
};

const DEFAULT_TIMEOUT_MS = 30_000;

export async function analyzeSourceFiles(
  repoSource: RepoSource | undefined,
  changedFiles: string[] | undefined,
  options?: Partial<AnalysisOptions>,
): Promise<AnalysisResult | null> {
  if (!repoSource || !changedFiles || changedFiles.length === 0) {
    return null;
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cache = options?.cache;

  const cacheKey: CacheKey = {
    repoId: `${repoSource.owner}/${repoSource.repo}`,
    sha: repoSource.sha,
    files: changedFiles,
  };

  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      return {
        imports: cached.imports,
        analyzedFiles: cached.analyzedFiles,
        fromCache: true,
      };
    }
  }

  const startTime = Date.now();
  
  try {
    const result = await Promise.race([
      performAnalysis(repoSource, changedFiles),
      createTimeout(timeoutMs),
    ]);

    const analysisTimeMs = Date.now() - startTime;

    if (result.timedOut) {
      return {
        imports: {},
        analyzedFiles: [],
        fromCache: false,
        analysisTimeMs,
        timedOut: true,
      };
    }

    if (cache && result.imports) {
      const cachedValue: CachedAnalysis = {
        imports: result.imports,
        analyzedFiles: result.analyzedFiles,
        cachedAt: new Date().toISOString(),
      };
      await cache.set(cacheKey, cachedValue);
    }

    return {
      imports: result.imports,
      analyzedFiles: result.analyzedFiles,
      fromCache: false,
      analysisTimeMs,
    };
  } catch {
    const analysisTimeMs = Date.now() - startTime;
    return {
      imports: {},
      analyzedFiles: [],
      fromCache: false,
      analysisTimeMs,
      timedOut: analysisTimeMs >= timeoutMs,
    };
  }
}

async function performAnalysis(
  repoSource: RepoSource,
  changedFiles: string[],
): Promise<{ imports: Record<string, string[]>; analyzedFiles: string[]; timedOut: false }> {
  return {
    imports: {},
    analyzedFiles: changedFiles,
    timedOut: false,
  };
}

async function createTimeout(ms: number): Promise<{ imports: Record<string, string[]>; analyzedFiles: string[]; timedOut: true }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        imports: {},
        analyzedFiles: [],
        timedOut: true,
      });
    }, ms);
  });
}

export function getAnalysisTimeoutMs(): number {
  const env = process.env.CODE_ANALYSIS_TIMEOUT_MS;
  if (!env) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(env);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export function getAnalysisCacheTtlMs(): number {
  const env = process.env.CODE_ANALYSIS_CACHE_TTL_MS;
  const defaultTtl = 24 * 60 * 60 * 1000;
  if (!env) return defaultTtl;
  const parsed = Number(env);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultTtl;
}
