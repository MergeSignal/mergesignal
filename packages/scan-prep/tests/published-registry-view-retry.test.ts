import { describe, expect, it, vi } from "vitest";

import { viewWithRetry } from "../../../scripts/ci/check-scan-prep-published-registry.ts";

const TRANSIENT = new Error(
  "npm error code E404\nnpm error 404 No match found for version 0.1.10",
);

describe("viewWithRetry npm visibility budget", () => {
  it("retries beyond the former 12-attempt budget then succeeds", () => {
    const viewOnce = vi.fn();
    for (let i = 0; i < 12; i++) {
      viewOnce.mockImplementationOnce(() => {
        throw TRANSIENT;
      });
    }
    viewOnce.mockReturnValueOnce("0.1.10");

    const sleep = vi.fn();

    expect(viewWithRetry("0.1.10", "version", { viewOnce, sleep })).toBe(
      "0.1.10",
    );

    expect(viewOnce).toHaveBeenCalledTimes(13);
    expect(sleep).toHaveBeenCalledTimes(12);
  });

  it("succeeds on the first attempt without sleeping", () => {
    const viewOnce = vi.fn().mockReturnValue("0.1.10");
    const sleep = vi.fn();

    expect(viewWithRetry("0.1.10", "version", { viewOnce, sleep })).toBe(
      "0.1.10",
    );

    expect(viewOnce).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("exhausts the budget with 24 attempts and 23 sleeps", () => {
    const viewOnce = vi.fn().mockImplementation(() => {
      throw TRANSIENT;
    });
    const sleep = vi.fn();

    expect(() =>
      viewWithRetry("0.1.10", "version", { viewOnce, sleep }),
    ).toThrow(/No match found for version/);

    expect(viewOnce).toHaveBeenCalledTimes(24);
    expect(sleep).toHaveBeenCalledTimes(23);
  });
});
