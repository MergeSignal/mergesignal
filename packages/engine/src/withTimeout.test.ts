import { describe, it, expect, vi } from "vitest";
import { EngineAbiTimeoutError, withTimeout } from "./withTimeout.js";

describe("withTimeout", () => {
  it("resolves when promise completes before timeout", async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, "test");
    expect(result).toBe(42);
  });

  it("rejects with EngineAbiTimeoutError when promise hangs", async () => {
    await expect(
      withTimeout(
        new Promise<number>(() => {
          /* never resolves */
        }),
        50,
        "abi_validation",
      ),
    ).rejects.toMatchObject({
      name: "EngineAbiTimeoutError",
      timeoutMs: 50,
      phase: "abi_validation",
    });
  });

  it("rejects with EngineAbiTimeoutError subclass", async () => {
    try {
      await withTimeout(new Promise<void>(() => {}), 10, "startup");
      expect.fail("expected timeout");
    } catch (e) {
      expect(e).toBeInstanceOf(EngineAbiTimeoutError);
      expect((e as EngineAbiTimeoutError).message).toMatch(
        /timed out after 10ms/,
      );
    }
  });

  it("clears timer when promise resolves", async () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");
    await withTimeout(Promise.resolve("ok"), 5000, "test");
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
