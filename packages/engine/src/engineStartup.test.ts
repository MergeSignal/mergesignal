import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initializeEngine,
  getEngineLoadInfo,
  __resetEngineLoaderCacheForTests,
  __resetEngineStartupCacheForTests,
  validateEngineAbi,
} from "./index.js";

describe("initializeEngine", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    __resetEngineLoaderCacheForTests();
    __resetEngineStartupCacheForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    __resetEngineLoaderCacheForTests();
    __resetEngineStartupCacheForTests();
    vi.restoreAllMocks();
  });

  it("returns cached result on second call without re-running ABI validation", async () => {
    process.env.NODE_ENV = "test";
    process.env.MERGESIGNAL_ENGINE_IMPL = "@mergesignal/engine-test-fixture";

    const abiSpy = vi.spyOn(
      await import("./validateEngineAbi.js"),
      "validateEngineAbi",
    );

    const first = await initializeEngine();
    const second = await initializeEngine();

    expect(first).toBe(second);
    expect(getEngineLoadInfo()).toBe(first);
    expect(abiSpy).toHaveBeenCalledTimes(1);
    expect(first.methodologyVersion).toBe("engine-test-fixture/v1");
    expect(first.stub).toBe(false);
    expect(first.abiValidationDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("requires MERGESIGNAL_ENGINE_IMPL in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.MERGESIGNAL_ENGINE_IMPL;
    delete process.env.MERGESIGNAL_ALLOW_STUB;

    await expect(initializeEngine()).rejects.toThrow(
      /requires MERGESIGNAL_ENGINE_IMPL/,
    );
  });

  it("loads stub metadata when no impl configured in dev", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.MERGESIGNAL_ENGINE_IMPL;

    const info = await initializeEngine();

    expect(info.stub).toBe(true);
    expect(info.spec).toBe("@mergesignal/engine-stub");
    expect(info.methodologyVersion).toBe("engine-stub/v2");
    expect(info.abiValidationDurationMs).toBe(0);
  });

  it("reads release metadata from manifest when present", async () => {
    process.env.NODE_ENV = "test";
    process.env.MERGESIGNAL_ENGINE_IMPL = "@mergesignal/engine-test-fixture";

    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ms-engine-manifest-"));
    const manifestPath = path.join(dir, "engine-manifest.json");
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        engineReleaseVersion: "v1.2.3",
        engineReleaseGitSha: "abc123",
        ref: "v1.2.3",
      }),
      "utf8",
    );
    process.env.MERGESIGNAL_ENGINE_MANIFEST = manifestPath;

    const info = await initializeEngine();

    expect(info.releaseVersion).toBe("v1.2.3");
    expect(info.releaseRef).toBe("v1.2.3");
    expect(info.releaseGitSha).toBe("abc123");

    await fs.rm(dir, { recursive: true, force: true });
  });
});

describe("validateEngineAbi isolation from scan path", () => {
  it("is not imported by runScanJob module graph", async () => {
    const runScanJobSource = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../apps/worker/src/runScanJob.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(runScanJobSource).not.toMatch(/validateEngineAbi/);
  });
});

// Re-export for lint satisfaction when validateEngineAbi used only in spy setup
void validateEngineAbi;
