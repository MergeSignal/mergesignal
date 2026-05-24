import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  __resetEngineLoaderCacheForTests,
  __resetEngineStartupCacheForTests,
} from "@mergesignal/engine";

vi.mock("./sentry.js", () => ({
  captureWorkerException: vi.fn(),
}));

describe("runEngineStartup", () => {
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
  });

  it("loads engine-test-fixture in dev with impl configured", async () => {
    process.env.NODE_ENV = "test";
    process.env.MERGESIGNAL_ENGINE_IMPL = "@mergesignal/engine-test-fixture";

    const { runEngineStartup } = await import("./engineStartup.js");
    const info = await runEngineStartup();

    expect(info.stub).toBe(false);
    expect(info.methodologyVersion).toBe("engine-test-fixture/v1");
  });
});
