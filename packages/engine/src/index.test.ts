import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { analyze, simulateUpgrade } from "./index.js";
import type { ScanRequest, UpgradeSimulationRequest } from "@mergesignal/shared";

describe("engine", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
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
      expect(["safe", "needs_review", "risky"]).toContain(result.decision?.recommendation);
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
        dependencyGraph: {
          nodes: [
            { id: "express@4.17.0", name: "express", version: "4.17.0" },
            { id: "lodash@4.17.20", name: "lodash", version: "4.17.20" },
          ],
        },
        upgradeTarget: {
          packageName: "express",
          fromVersion: "4.17.0",
          toVersion: "4.18.0",
        },
      };

      const result = await simulateUpgrade(request);

      expect(result).toBeDefined();
      expect(result.packageName).toBe("express");
      expect(result.fromVersion).toBe("4.17.0");
      expect(result.toVersion).toBe("4.18.0");
      expect(result.risk).toBeDefined();
      expect(["low", "medium", "high"]).toContain(result.risk);
    });

    it("should include breaking changes analysis", async () => {
      const request: UpgradeSimulationRequest = {
        repoId: "test/repo",
        dependencyGraph: {
          nodes: [{ id: "pkg@1.0.0", name: "pkg", version: "1.0.0" }],
        },
        upgradeTarget: {
          packageName: "pkg",
          fromVersion: "1.0.0",
          toVersion: "2.0.0",
        },
      };

      const result = await simulateUpgrade(request);

      expect(result).toBeDefined();
      expect(result.breakingChanges).toBeDefined();
      expect(Array.isArray(result.breakingChanges)).toBe(true);
    });

    it("should include recommendation", async () => {
      const request: UpgradeSimulationRequest = {
        repoId: "test/repo",
        dependencyGraph: {
          nodes: [{ id: "pkg@1.0.0", name: "pkg", version: "1.0.0" }],
        },
        upgradeTarget: {
          packageName: "pkg",
          fromVersion: "1.0.0",
          toVersion: "1.1.0",
        },
      };

      const result = await simulateUpgrade(request);

      expect(result.recommendation).toBeDefined();
      expect(["safe", "caution", "risky"]).toContain(result.recommendation);
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
