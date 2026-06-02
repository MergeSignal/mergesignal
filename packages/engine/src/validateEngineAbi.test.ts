import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
