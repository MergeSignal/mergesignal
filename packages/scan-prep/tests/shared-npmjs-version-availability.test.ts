import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyNpmjsSharedVersionAvailability,
  SHARED_PACKAGE_NAME,
} from "../../../scripts/ci/lib/shared-npmjs-version-availability.ts";
import { buildNpmjsPackageVersionUrl } from "../../../scripts/ci/lib/npmjs-registry.ts";

const VERSION = "0.20.0";

function mockRegistryResponse(status: number, body: string): typeof fetch {
  return vi.fn().mockResolvedValue(new Response(body, { status }));
}

describe("shared npmjs version availability adapter", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("delegates to the generic exact-version registry authority", async () => {
    const fetchImpl = mockRegistryResponse(
      200,
      JSON.stringify({
        name: SHARED_PACKAGE_NAME,
        version: VERSION,
      }),
    );

    vi.stubGlobal("fetch", fetchImpl);

    await expect(
      classifyNpmjsSharedVersionAvailability(VERSION),
    ).resolves.toEqual({
      kind: "published",
      version: VERSION,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      buildNpmjsPackageVersionUrl(SHARED_PACKAGE_NAME, VERSION),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("classifies HTTP 404 as not_found", async () => {
    vi.stubGlobal("fetch", mockRegistryResponse(404, "{}"));

    await expect(
      classifyNpmjsSharedVersionAvailability(VERSION),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("fails closed on HTTP 502", async () => {
    vi.stubGlobal("fetch", mockRegistryResponse(502, "{}"));

    await expect(
      classifyNpmjsSharedVersionAvailability(VERSION),
    ).resolves.toEqual({
      kind: "unavailable",
      message: expect.stringContaining("HTTP 502"),
    });
  });
});
