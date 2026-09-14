import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  validateEngineAbi,
  ABI_PROBE_SCAN_REQUEST,
  ABI_PROBE_UPGRADE_REQUEST,
  __resetEngineLoaderCacheForTests,
} from "./index.js";
import { EngineAbiTimeoutError } from "./withTimeout.js";

describe("validateEngineAbi", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    __resetEngineLoaderCacheForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    __resetEngineLoaderCacheForTests();
    vi.restoreAllMocks();
  });

  it("validates engine-test-fixture exports and probe contract", async () => {
    const result = await validateEngineAbi("@mergesignal/engine-test-fixture");

    expect(result.ok).toBe(true);
    expect(result.methodologyVersion).toBe("engine-test-fixture/v1");
    expect(result.probeDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.supportsCodeAnalysisArgument).toBe(true);
  });

  it("uses minimal ABI probe inputs", () => {
    expect(ABI_PROBE_SCAN_REQUEST.repoId).toBe(
      "__mergesignal_engine_abi_probe__",
    );
    expect(ABI_PROBE_SCAN_REQUEST.dependencyGraph).toEqual({});
    expect(ABI_PROBE_UPGRADE_REQUEST.repoId).toBe(
      "__mergesignal_engine_abi_probe__",
    );
    expect(ABI_PROBE_UPGRADE_REQUEST.target?.packageName).toBe("__abi_probe__");
  });

  it("rejects empty spec", async () => {
    await expect(validateEngineAbi("  ")).rejects.toThrow(
      /non-empty module spec/,
    );
  });

  it("rejects missing module", async () => {
    await expect(
      validateEngineAbi("nonexistent-mergesignal-engine-module-xyz123"),
    ).rejects.toThrow();
  });

  it("rejects stub methodology", async () => {
    process.env.NODE_ENV = "test";
    await expect(validateEngineAbi("@mergesignal/engine-stub")).rejects.toThrow(
      /verification requirements|stub methodology/,
    );
  });

  it("rejects collection ingress sha256 mismatch for file impl", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ms-abi-sha-"));
    const dist = path.join(tmp, "dist");
    fs.mkdirSync(dist, { recursive: true });
    fs.writeFileSync(
      path.join(dist, "index.js"),
      `export async function analyze(req, codeAnalysis, options) {
        return {
          repoId: req.repoId,
          dependencyGraph: req.dependencyGraph ?? {},
          generatedAt: new Date().toISOString(),
          methodologyVersion: 'abi-sha-test/v1',
        };
      }
      export async function simulateUpgrade() {
        return { before: {}, after: {}, delta: {}, generatedAt: new Date().toISOString() };
      }`,
    );
    fs.writeFileSync(
      path.join(dist, "production-scan-ingress.js"),
      "export async function orchestrateProductionScanIngress() { return {}; }\n",
    );
    fs.writeFileSync(
      path.join(tmp, "engine-manifest.json"),
      JSON.stringify({
        collectionIngressPath: "dist/production-scan-ingress.js",
        collectionIngressSha256: "0".repeat(64),
        distSha256: "fixture",
      }),
    );
    process.env.MERGESIGNAL_ENGINE_MANIFEST = path.join(
      tmp,
      "engine-manifest.json",
    );
    await expect(
      validateEngineAbi(`file:${path.join(dist, "index.js")}`),
    ).rejects.toThrow(/collectionIngressSha256 mismatch/);
  });

  it("propagates EngineAbiTimeoutError from withTimeout wrapper", async () => {
    const timeoutMod = await import("./withTimeout.js");
    vi.spyOn(timeoutMod, "withTimeout").mockRejectedValueOnce(
      new EngineAbiTimeoutError(30, "abi_validation"),
    );

    await expect(
      validateEngineAbi("@mergesignal/engine-test-fixture"),
    ).rejects.toBeInstanceOf(EngineAbiTimeoutError);
  });
});
