import { describe, expect, it, vi } from "vitest";

import {
  NPMJS_REGISTRY_PUBLICATION_MAX_ATTEMPTS,
  waitForPublishedScanPrepDocument,
} from "../../../scripts/ci/check-scan-prep-published-registry.ts";

const NOT_FOUND = { kind: "not_found" as const };
const TRANSIENT_UNAVAILABLE = {
  kind: "unavailable" as const,
  message: "npmjs registry returned HTTP 503",
};

describe("waitForPublishedScanPrepDocument registry visibility budget", () => {
  it("retries beyond the former 24-attempt budget then succeeds", async () => {
    const query = vi.fn();
    for (let i = 0; i < 24; i++) {
      query.mockResolvedValueOnce(NOT_FOUND);
    }
    query.mockResolvedValueOnce({
      kind: "published",
      document: {
        name: "@mergesignal/scan-prep",
        version: "0.1.11",
        dependencies: { "@mergesignal/shared": "0.22.0" },
        publishConfig: { access: "public" },
      },
    });

    const sleep = vi.fn();

    await expect(
      waitForPublishedScanPrepDocument("0.1.11", { query, sleep }),
    ).resolves.toMatchObject({ version: "0.1.11" });

    expect(query).toHaveBeenCalledTimes(25);
    expect(sleep).toHaveBeenCalledTimes(24);
  });

  it("succeeds on the first attempt without sleeping", async () => {
    const query = vi.fn().mockResolvedValue({
      kind: "published",
      document: {
        name: "@mergesignal/scan-prep",
        version: "0.1.11",
        publishConfig: { access: "public" },
      },
    });
    const sleep = vi.fn();

    await expect(
      waitForPublishedScanPrepDocument("0.1.11", { query, sleep }),
    ).resolves.toMatchObject({ version: "0.1.11" });

    expect(query).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("exhausts the budget with 36 attempts and 35 sleeps", async () => {
    const query = vi.fn().mockResolvedValue(NOT_FOUND);
    const sleep = vi.fn();

    await expect(
      waitForPublishedScanPrepDocument("0.1.11", {
        query,
        sleep,
        maxAttempts: NPMJS_REGISTRY_PUBLICATION_MAX_ATTEMPTS,
      }),
    ).rejects.toThrow(/not found on npmjs/);

    expect(query).toHaveBeenCalledTimes(
      NPMJS_REGISTRY_PUBLICATION_MAX_ATTEMPTS,
    );
    expect(sleep).toHaveBeenCalledTimes(
      NPMJS_REGISTRY_PUBLICATION_MAX_ATTEMPTS - 1,
    );
  });

  it("retries transient unavailable responses", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(TRANSIENT_UNAVAILABLE)
      .mockResolvedValueOnce({
        kind: "published",
        document: {
          name: "@mergesignal/scan-prep",
          version: "0.1.11",
          publishConfig: { access: "public" },
        },
      });
    const sleep = vi.fn();

    await expect(
      waitForPublishedScanPrepDocument("0.1.11", { query, sleep }),
    ).resolves.toMatchObject({ version: "0.1.11" });

    expect(query).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
