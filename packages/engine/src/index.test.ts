import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  analyze,
  simulateUpgrade,
  __resetEngineLoaderCacheForTests,
  requiresStrictEngineScanValidation,
} from "./index.js";
import type {
  ScanRequest,
  UpgradeSimulationRequest,
} from "@mergesignal/shared";

describe("engine", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    __resetEngineLoaderCacheForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    __resetEngineLoaderCacheForTests();
  });

  describe("loader policy", () => {
    it("rejects production without MERGESIGNAL_ENGINE_IMPL when stub disallowed", async () => {
      process.env.NODE_ENV = "production";
      delete process.env.MERGESIGNAL_ENGINE_IMPL;
      delete process.env.MERGESIGNAL_ALLOW_STUB;

      await expect(
        analyze({ repoId: "o/r", dependencyGraph: {} }),
      ).rejects.toThrow(/configured analysis engine is required/);
    });

    it("allows stub in production when MERGESIGNAL_ALLOW_STUB=1", async () => {
      process.env.NODE_ENV = "production";
      delete process.env.MERGESIGNAL_ENGINE_IMPL;
      process.env.MERGESIGNAL_ALLOW_STUB = "1";

      const result = await analyze({ repoId: "o/r", dependencyGraph: {} });
      expect(result.methodologyVersion).toBe("engine-stub/v2");
    });

    it("throws on bad MERGESIGNAL_ENGINE_IMPL when MERGESIGNAL_ENGINE_STRICT=1", async () => {
      process.env.NODE_ENV = "test";
      process.env.MERGESIGNAL_ENGINE_IMPL =
        "nonexistent-mergesignal-engine-module-xyz123";
      process.env.MERGESIGNAL_ENGINE_STRICT = "1";

      await expect(
        analyze({ repoId: "o/r", dependencyGraph: {} }),
      ).rejects.toThrow();
    });

    it("rejects trusted analysis without MERGESIGNAL_ENGINE_IMPL", async () => {
      process.env.NODE_ENV = "test";
      process.env.MERGESIGNAL_TRUSTED_ANALYSIS = "1";
      delete process.env.MERGESIGNAL_ENGINE_IMPL;
      delete process.env.MERGESIGNAL_ALLOW_STUB;

      await expect(
        analyze({ repoId: "o/r", dependencyGraph: {} }),
      ).rejects.toThrow(
        /Trusted analysis requires a configured analysis engine/,
      );
    });

    it("does not fall back to stub on bad MERGESIGNAL_ENGINE_IMPL when trusted", async () => {
      process.env.NODE_ENV = "test";
      process.env.MERGESIGNAL_TRUSTED_ANALYSIS = "1";
      process.env.MERGESIGNAL_ENGINE_IMPL =
        "nonexistent-mergesignal-engine-module-xyz123";
      delete process.env.MERGESIGNAL_ALLOW_STUB;
      delete process.env.MERGESIGNAL_ENGINE_STRICT;

      await expect(
        analyze({ repoId: "o/r", dependencyGraph: {} }),
      ).rejects.toThrow();
    });

    it("allows stub when trusted and MERGESIGNAL_ALLOW_STUB=1 without impl", async () => {
      process.env.NODE_ENV = "test";
      process.env.MERGESIGNAL_TRUSTED_ANALYSIS = "1";
      process.env.MERGESIGNAL_ALLOW_STUB = "1";
      delete process.env.MERGESIGNAL_ENGINE_IMPL;

      const result = await analyze({ repoId: "o/r", dependencyGraph: {} });
      expect(result.methodologyVersion).toBe("engine-stub/v2");
    });
  });

  describe("requiresStrictEngineScanValidation", () => {
    it("is false when MERGESIGNAL_ALLOW_STUB=1", () => {
      expect(
        requiresStrictEngineScanValidation({
          ...process.env,
          MERGESIGNAL_ALLOW_STUB: "1",
          NODE_ENV: "production",
        }),
      ).toBe(false);
    });

    it("is true in production when stub is not allowed", () => {
      expect(
        requiresStrictEngineScanValidation({
          ...process.env,
          NODE_ENV: "production",
          MERGESIGNAL_ALLOW_STUB: undefined,
        }),
      ).toBe(true);
    });

    it("is true when MERGESIGNAL_TRUSTED_ANALYSIS=1 and stub is not allowed", () => {
      expect(
        requiresStrictEngineScanValidation({
          ...process.env,
          NODE_ENV: "test",
          MERGESIGNAL_TRUSTED_ANALYSIS: "1",
          MERGESIGNAL_ALLOW_STUB: undefined,
        }),
      ).toBe(true);
    });
  });

  describe("analyze", () => {
    it("should export analyze function", () => {
      expect(typeof analyze).toBe("function");
    });

    it("should analyze empty dependency graph using stub engine", async () => {
      const request: ScanRequest = {
        repoId: "test/repo",
        dependencyGraph: {},
      };

      const result = await analyze(request);

      expect(result).toBeDefined();
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
      expect(result.methodologyVersion).toBe("engine-stub/v2");
      expect(result.layerScores).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });

    it("should analyze dependency graph with nodes", async () => {
      const request: ScanRequest = {
        repoId: "test/repo",
        dependencyGraph: {
          nodes: [
            { id: "express@4.18.0", name: "express", version: "4.18.0" },
            { id: "lodash@4.17.21", name: "lodash", version: "4.17.21" },
          ],
          edges: [{ from: "express@4.18.0", to: "lodash@4.17.21" }],
        },
      };

      const result = await analyze(request);

      expect(result).toBeDefined();
      expect(result.signals).toBeDefined();
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.findings).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
    });

    it("should include insights and decision in results", async () => {
      const request: ScanRequest = {
        repoId: "test/repo",
        dependencyGraph: {
          nodes: [{ id: "pkg@1.0.0", name: "pkg", version: "1.0.0" }],
        },
      };

      const result = await analyze(request);

      expect(result.insights).toBeDefined();
      expect(Array.isArray(result.insights)).toBe(true);
      expect(result.decision).toBeDefined();
      expect(result.decision?.recommendation).toBeDefined();
      expect(["safe", "needs_review", "risky"]).toContain(
        result.decision?.recommendation,
      );
    });

    it("should handle lockfile in request", async () => {
      const pnpmLockfile = `
lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      express:
        specifier: ^4.18.0
        version: 4.18.2
`;

      const request: ScanRequest = {
        repoId: "test/repo",
        dependencyGraph: {},
        lockfile: {
          manager: "pnpm",
          content: pnpmLockfile,
          path: "pnpm-lock.yaml",
        },
      };

      const result = await analyze(request);

      expect(result).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });

  describe("simulateUpgrade", () => {
    it("should export simulateUpgrade function", () => {
      expect(typeof simulateUpgrade).toBe("function");
    });

    it("should simulate package upgrade", async () => {
      const request: UpgradeSimulationRequest = {
        repoId: "test/repo",
        currentLockfile: {
          manager: "pnpm",
          content: `lockfileVersion: '6.0'\ndependencies:\n  express:\n    specifier: ^4.17.0\n    version: 4.17.0`,
        },
        proposedLockfile: {
          manager: "pnpm",
          content: `lockfileVersion: '6.0'\ndependencies:\n  express:\n    specifier: ^4.18.0\n    version: 4.18.0`,
        },
        target: {
          packageName: "express",
          targetVersion: "4.18.0",
        },
      };

      const result = await simulateUpgrade(request);

      expect(result).toBeDefined();
      expect(result.before).toBeDefined();
      expect(result.after).toBeDefined();
      expect(result.delta).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });

    it("should include delta analysis", async () => {
      const request: UpgradeSimulationRequest = {
        repoId: "test/repo",
        currentLockfile: {
          manager: "pnpm",
          content: `lockfileVersion: '6.0'\ndependencies:\n  pkg:\n    specifier: ^1.0.0\n    version: 1.0.0`,
        },
        proposedLockfile: {
          manager: "pnpm",
          content: `lockfileVersion: '6.0'\ndependencies:\n  pkg:\n    specifier: ^2.0.0\n    version: 2.0.0`,
        },
        target: {
          packageName: "pkg",
          targetVersion: "2.0.0",
        },
      };

      const result = await simulateUpgrade(request);

      expect(result).toBeDefined();
      expect(result.delta).toBeDefined();
    });

    it("should include before and after scan results", async () => {
      const request: UpgradeSimulationRequest = {
        repoId: "test/repo",
        currentLockfile: {
          manager: "pnpm",
          content: `lockfileVersion: '6.0'\ndependencies:\n  pkg:\n    specifier: ^1.0.0\n    version: 1.0.0`,
        },
        proposedLockfile: {
          manager: "pnpm",
          content: `lockfileVersion: '6.0'\ndependencies:\n  pkg:\n    specifier: ^1.1.0\n    version: 1.1.0`,
        },
        target: {
          packageName: "pkg",
          targetVersion: "1.1.0",
        },
      };

      const result = await simulateUpgrade(request);

      expect(result.before).toBeDefined();
      expect(result.before.totalScore).toBeDefined();
      expect(typeof result.before.totalScore).toBe("number");
    });
  });

  describe("type exports", () => {
    it("should be importable from @mergesignal/shared", async () => {
      const shared = await import("@mergesignal/shared");

      expect(shared).toBeDefined();
    });
  });

  describe("caching", () => {
    it("should cache engine implementation between calls", async () => {
      const request1: ScanRequest = {
        repoId: "test/repo1",
        dependencyGraph: {},
      };

      const request2: ScanRequest = {
        repoId: "test/repo2",
        dependencyGraph: {},
      };

      const result1 = await analyze(request1);
      const result2 = await analyze(request2);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.methodologyVersion).toBe(result2.methodologyVersion);
    });
  });
});
