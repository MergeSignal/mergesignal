import { describe, it, expect } from "vitest";
import { analyze } from "./analyze.js";
import type { ScanRequest } from "@reposentinel/shared";

describe("analyze", () => {
  it("should return a scan result with default values for empty input", async () => {
    const request: ScanRequest = {
      repoId: "test/repo",
      dependencyGraph: {},
    };

    const result = await analyze(request);

    expect(result).toBeDefined();
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.methodologyVersion).toBe("engine-stub/v2");
    expect(result.confidence).toBe("low");
    expect(result.layerScores).toBeDefined();
    expect(result.layerScores.security).toBeGreaterThanOrEqual(0);
    expect(result.layerScores.maintainability).toBeGreaterThanOrEqual(0);
    expect(result.layerScores.ecosystem).toBeGreaterThanOrEqual(0);
    expect(result.layerScores.upgradeImpact).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.signals)).toBe(true);
    expect(Array.isArray(result.findings)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(result.generatedAt).toBeDefined();
  });

  it("should produce medium confidence with graph-like input", async () => {
    const request: ScanRequest = {
      repoId: "test/repo",
      dependencyGraph: {
        nodes: [
          { id: "pkg-1", name: "express", version: "4.18.0" },
          { id: "pkg-2", name: "lodash", version: "4.17.21" },
        ],
        edges: [{ from: "pkg-1", to: "pkg-2" }],
      },
    };

    const result = await analyze(request);

    expect(result.confidence).toBe("medium");
    expect(result.signals).toBeDefined();
    expect(result.signals!.length).toBeGreaterThan(0);
  });

  it("should include recommendations for empty graph", async () => {
    const request: ScanRequest = {
      repoId: "test/repo",
      dependencyGraph: {},
    };

    const result = await analyze(request);

    expect(result.recommendations).toBeDefined();
    expect(result.recommendations!.length).toBeGreaterThan(0);
    const lockfileRec = result.recommendations!.find((r) => r.id === "provide-lockfile");
    expect(lockfileRec).toBeDefined();
    expect(lockfileRec?.title).toContain("lockfile");
  });

  it("should produce higher scores for large dependency graphs", async () => {
    const smallRequest: ScanRequest = {
      repoId: "test/small",
      dependencyGraph: {
        nodes: Array.from({ length: 10 }, (_, i) => ({
          id: `pkg-${i}`,
          name: `package-${i}`,
          version: "1.0.0",
        })),
      },
    };

    const largeRequest: ScanRequest = {
      repoId: "test/large",
      dependencyGraph: {
        nodes: Array.from({ length: 500 }, (_, i) => ({
          id: `pkg-${i}`,
          name: `package-${i}`,
          version: "1.0.0",
        })),
      },
    };

    const smallResult = await analyze(smallRequest);
    const largeResult = await analyze(largeRequest);

    expect(largeResult.totalScore).toBeGreaterThan(smallResult.totalScore);
  });

  it("should handle pnpm lockfile parsing", async () => {
    const pnpmLockfile = `
lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:
  .:
    dependencies:
      express:
        specifier: ^4.18.0
        version: 4.18.2

packages:
  express@4.18.2:
    resolution: {integrity: sha512-test}
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

    expect(result.confidence).toBe("medium");
  });

  it("should produce signals for multiple layers", async () => {
    const request: ScanRequest = {
      repoId: "test/repo",
      dependencyGraph: {
        nodes: Array.from({ length: 50 }, (_, i) => ({
          id: `pkg-${i}`,
          name: `package-${i}`,
          version: "1.0.0",
        })),
      },
    };

    const result = await analyze(request);

    expect(result.signals).toBeDefined();
    expect(result.signals!.length).toBeGreaterThan(0);
    
    const layers = new Set(result.signals!.map((s) => s.layer));
    // At minimum, we should have maintainability and ecosystem signals for a graph
    expect(layers.has("maintainability")).toBe(true);
    expect(layers.has("ecosystem")).toBe(true);
  });

  it("should include generatedAt timestamp", async () => {
    const request: ScanRequest = {
      repoId: "test/repo",
      dependencyGraph: {},
    };

    const before = new Date();
    const result = await analyze(request);
    const after = new Date();

    expect(result.generatedAt).toBeDefined();
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    const resultDate = new Date(result.generatedAt);
    expect(resultDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(resultDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
