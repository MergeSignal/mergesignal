import { describe, it, expect, beforeEach, vi } from "vitest";
import { analyzeSourceFiles, getAnalysisTimeoutMs, getAnalysisCacheTtlMs } from "./codeAnalysisService.js";
import { CodeAnalysisCache } from "./codeAnalysisCache.js";
import type { RepoSource } from "@mergesignal/shared";

describe("codeAnalysisService", () => {
  describe("analyzeSourceFiles", () => {
    it("returns null when no repoSource provided", async () => {
      const result = await analyzeSourceFiles(undefined, ["file.ts"]);
      expect(result).toBeNull();
    });

    it("returns null when no changedFiles provided", async () => {
      const repoSource: RepoSource = {
        provider: "github",
        owner: "test",
        repo: "repo",
        sha: "abc123",
        installationId: 1,
      };
      const result = await analyzeSourceFiles(repoSource, []);
      expect(result).toBeNull();
    });

    it("returns cache hit when available", async () => {
      const repoSource: RepoSource = {
        provider: "github",
        owner: "test",
        repo: "repo",
        sha: "abc123",
        installationId: 1,
      };
      const changedFiles = ["src/file.ts"];

      const mockCache = {
        get: vi.fn().mockResolvedValue({
          imports: { "src/file.ts": ["react", "lodash"] },
          analyzedFiles: changedFiles,
          cachedAt: new Date().toISOString(),
        }),
        set: vi.fn(),
      } as unknown as CodeAnalysisCache;

      const result = await analyzeSourceFiles(repoSource, changedFiles, { cache: mockCache });

      expect(result).not.toBeNull();
      expect(result?.fromCache).toBe(true);
      expect(result?.imports).toEqual({ "src/file.ts": ["react", "lodash"] });
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it("performs analysis and caches result when cache miss", async () => {
      const repoSource: RepoSource = {
        provider: "github",
        owner: "test",
        repo: "repo",
        sha: "abc123",
        installationId: 1,
      };
      const changedFiles = ["src/file.ts"];

      const mockCache = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
      } as unknown as CodeAnalysisCache;

      const result = await analyzeSourceFiles(repoSource, changedFiles, { cache: mockCache });

      expect(result).not.toBeNull();
      expect(result?.fromCache).toBe(false);
      expect(result?.analyzedFiles).toEqual(changedFiles);
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
    });

    it("respects timeout and returns graceful degradation", async () => {
      const repoSource: RepoSource = {
        provider: "github",
        owner: "test",
        repo: "repo",
        sha: "abc123",
        installationId: 1,
      };
      const changedFiles = ["src/file.ts"];

      const result = await analyzeSourceFiles(repoSource, changedFiles, { timeoutMs: 1 });

      expect(result).not.toBeNull();
      
      if (result?.timedOut) {
        expect(result.imports).toEqual({});
        expect(result.analysisTimeMs).toBeGreaterThanOrEqual(1);
      } else {
        expect(result?.fromCache).toBe(false);
      }
    }, 15000);

    it("works without cache", async () => {
      const repoSource: RepoSource = {
        provider: "github",
        owner: "test",
        repo: "repo",
        sha: "abc123",
        installationId: 1,
      };
      const changedFiles = ["src/file.ts"];

      const result = await analyzeSourceFiles(repoSource, changedFiles);

      expect(result).not.toBeNull();
      expect(result?.fromCache).toBe(false);
      expect(result?.analyzedFiles).toEqual(changedFiles);
    });
  });

  describe("getAnalysisTimeoutMs", () => {
    beforeEach(() => {
      delete process.env.CODE_ANALYSIS_TIMEOUT_MS;
    });

    it("returns default timeout when env var not set", () => {
      const timeout = getAnalysisTimeoutMs();
      expect(timeout).toBe(30000);
    });

    it("returns custom timeout when env var set", () => {
      process.env.CODE_ANALYSIS_TIMEOUT_MS = "60000";
      const timeout = getAnalysisTimeoutMs();
      expect(timeout).toBe(60000);
    });

    it("returns default timeout when env var is invalid", () => {
      process.env.CODE_ANALYSIS_TIMEOUT_MS = "invalid";
      const timeout = getAnalysisTimeoutMs();
      expect(timeout).toBe(30000);
    });
  });

  describe("getAnalysisCacheTtlMs", () => {
    beforeEach(() => {
      delete process.env.CODE_ANALYSIS_CACHE_TTL_MS;
    });

    it("returns default TTL when env var not set", () => {
      const ttl = getAnalysisCacheTtlMs();
      expect(ttl).toBe(24 * 60 * 60 * 1000);
    });

    it("returns custom TTL when env var set", () => {
      process.env.CODE_ANALYSIS_CACHE_TTL_MS = "3600000";
      const ttl = getAnalysisCacheTtlMs();
      expect(ttl).toBe(3600000);
    });

    it("returns default TTL when env var is invalid", () => {
      process.env.CODE_ANALYSIS_CACHE_TTL_MS = "invalid";
      const ttl = getAnalysisCacheTtlMs();
      expect(ttl).toBe(24 * 60 * 60 * 1000);
    });
  });
});

describe("CodeAnalysisCache", () => {
  it("is disabled when redis is null", async () => {
    const cache = new CodeAnalysisCache(null);
    const key = { repoId: "test/repo", sha: "abc123", files: ["file.ts"] };
    const value = {
      imports: { "file.ts": ["react"] },
      analyzedFiles: ["file.ts"],
      cachedAt: new Date().toISOString(),
    };

    await cache.set(key, value);
    const result = await cache.get(key);

    expect(result).toBeNull();
  });
});

describe("Performance benchmarks", () => {
  it("benchmark: analyze 10 files", async () => {
    const repoSource: RepoSource = {
      provider: "github",
      owner: "test",
      repo: "large-repo",
      sha: "abc123",
      installationId: 1,
    };
    const changedFiles = Array.from({ length: 10 }, (_, i) => `src/file${i}.ts`);

    const start = Date.now();
    const result = await analyzeSourceFiles(repoSource, changedFiles, { timeoutMs: 30000 });
    const elapsed = Date.now() - start;

    expect(result).not.toBeNull();
    expect(elapsed).toBeLessThan(30000);
  });

  it("benchmark: analyze 100 files", async () => {
    const repoSource: RepoSource = {
      provider: "github",
      owner: "test",
      repo: "large-repo",
      sha: "abc123",
      installationId: 1,
    };
    const changedFiles = Array.from({ length: 100 }, (_, i) => `src/file${i}.ts`);

    const start = Date.now();
    const result = await analyzeSourceFiles(repoSource, changedFiles, { timeoutMs: 30000 });
    const elapsed = Date.now() - start;

    expect(result).not.toBeNull();
    expect(elapsed).toBeLessThan(30000);
  });

  it("benchmark: analyze 1000 files with timeout", async () => {
    const repoSource: RepoSource = {
      provider: "github",
      owner: "test",
      repo: "very-large-repo",
      sha: "abc123",
      installationId: 1,
    };
    const changedFiles = Array.from({ length: 1000 }, (_, i) => `src/file${i}.ts`);

    const start = Date.now();
    const result = await analyzeSourceFiles(repoSource, changedFiles, { timeoutMs: 30000 });
    const elapsed = Date.now() - start;

    expect(result).not.toBeNull();
    expect(elapsed).toBeLessThan(31000);
    
    if (result?.timedOut) {
      console.log(`Analysis timed out after ${elapsed}ms for ${changedFiles.length} files`);
    } else {
      console.log(`Analysis completed in ${elapsed}ms for ${changedFiles.length} files`);
    }
  });
});
