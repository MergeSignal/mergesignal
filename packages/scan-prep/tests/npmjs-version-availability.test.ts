import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyNpmjsScanPrepVersionAvailability,
  PACKAGE_NAME,
} from "../../../scripts/ci/lib/scan-prep-npmjs-version-availability.ts";
import { buildNpmjsPackageVersionUrl } from "../../../scripts/ci/lib/npmjs-registry.ts";

describe("scan-prep npmjs version availability adapter", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("queries exact-version registry metadata for @mergesignal/scan-prep", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          name: PACKAGE_NAME,
          version: "0.1.9",
          dependencies: { "@mergesignal/shared": "0.19.1" },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchImpl);

    await expect(
      classifyNpmjsScanPrepVersionAvailability("0.1.9"),
    ).resolves.toEqual({
      kind: "published",
      version: "0.1.9",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      buildNpmjsPackageVersionUrl(PACKAGE_NAME, "0.1.9"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("classifies HTTP 404 as not_found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 404 })),
    );

    await expect(
      classifyNpmjsScanPrepVersionAvailability("9.9.9-unpublished"),
    ).resolves.toEqual({ kind: "not_found" });
  });
});
