import { describe, expect, it, vi } from "vitest";

import { verifyIsolatedInstallUntilReady } from "../../../scripts/ci/check-scan-prep-published-registry.ts";

const VERSION = "0.1.12";
const SHARED_VERSION = "0.22.1";

describe("verifyIsolatedInstallUntilReady", () => {
  it("retries a failed complete verification once and then accepts success", () => {
    const verify = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("registry not ready");
      })
      .mockImplementationOnce(() => undefined);
    const sleep = vi.fn();

    verifyIsolatedInstallUntilReady(VERSION, SHARED_VERSION, {
      verify,
      sleep,
    });

    expect(verify).toHaveBeenCalledTimes(2);
    expect(verify).toHaveBeenNthCalledWith(1, VERSION, SHARED_VERSION);
    expect(verify).toHaveBeenNthCalledWith(2, VERSION, SHARED_VERSION);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it("rethrows the original error after 10 failed verifications", () => {
    const error = new Error("published lockfile assertion failed");
    const verify = vi.fn(() => {
      throw error;
    });
    const sleep = vi.fn();

    expect(() =>
      verifyIsolatedInstallUntilReady(VERSION, SHARED_VERSION, {
        verify,
        sleep,
      }),
    ).toThrow(error);

    expect(verify).toHaveBeenCalledTimes(10);
    expect(sleep).toHaveBeenCalledTimes(9);
    expect(sleep).toHaveBeenCalledWith(10);
  });
});
