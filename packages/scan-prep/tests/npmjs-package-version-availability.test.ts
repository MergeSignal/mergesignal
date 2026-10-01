import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildNpmjsPackageVersionUrl,
  encodeNpmjsPackageNameForRegistryPath,
} from "../../../scripts/ci/lib/npmjs-registry.ts";
import {
  classifyNpmjsPackageVersionAvailability,
  classifyNpmjsPublicationFromHttpResponse,
  parseNpmjsPackageVersionDocument,
  queryNpmjsExactPackageVersionPublication,
  readSharedDependencyPinFromNpmjsPackageVersionDocument,
} from "../../../scripts/ci/lib/npmjs-package-version-availability.ts";

const PACKAGE = "@mergesignal/scan-prep";
const VERSION = "8.8.8-test";

function manifest(
  overrides: Partial<{ name: string; version: string; shared: string }> = {},
): string {
  return JSON.stringify({
    name: overrides.name ?? PACKAGE,
    version: overrides.version ?? VERSION,
    dependencies: {
      "@mergesignal/shared": overrides.shared ?? "0.19.1",
    },
  });
}

describe("npmjs registry URL construction", () => {
  it("encodes scoped package paths for the exact-version endpoint", () => {
    expect(encodeNpmjsPackageNameForRegistryPath(PACKAGE)).toBe(
      "@mergesignal%2Fscan-prep",
    );
    expect(buildNpmjsPackageVersionUrl(PACKAGE, VERSION)).toBe(
      "https://registry.npmjs.org/@mergesignal%2Fscan-prep/8.8.8-test",
    );
  });
});

describe("parseNpmjsPackageVersionDocument", () => {
  it("accepts a valid exact-version document", () => {
    expect(
      parseNpmjsPackageVersionDocument(manifest(), PACKAGE, VERSION),
    ).toEqual({
      name: PACKAGE,
      version: VERSION,
      dependencies: { "@mergesignal/shared": "0.19.1" },
    });
  });

  it("rejects wrong package or version", () => {
    expect(
      parseNpmjsPackageVersionDocument(
        manifest({ version: "9.9.9" }),
        PACKAGE,
        VERSION,
      ),
    ).toBeNull();
    expect(
      parseNpmjsPackageVersionDocument(
        manifest({ name: "@mergesignal/shared" }),
        PACKAGE,
        VERSION,
      ),
    ).toBeNull();
  });

  it("rejects malformed JSON", () => {
    expect(
      parseNpmjsPackageVersionDocument("not-json", PACKAGE, VERSION),
    ).toBeNull();
  });
});

describe("classifyNpmjsPublicationFromHttpResponse", () => {
  it("classifies HTTP 200 with a valid document as published", () => {
    expect(
      classifyNpmjsPublicationFromHttpResponse(
        200,
        manifest(),
        PACKAGE,
        VERSION,
      ),
    ).toEqual({
      kind: "published",
      document: {
        name: PACKAGE,
        version: VERSION,
        dependencies: { "@mergesignal/shared": "0.19.1" },
      },
    });
  });

  it("classifies HTTP 404 as not_found", () => {
    expect(
      classifyNpmjsPublicationFromHttpResponse(404, "{}", PACKAGE, VERSION),
    ).toEqual({ kind: "not_found" });
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [408, "timeout"],
    [429, "rate limited"],
    [500, "server error"],
    [502, "bad gateway"],
    [503, "unavailable"],
  ])("fails closed on HTTP %i (%s)", (status) => {
    expect(
      classifyNpmjsPublicationFromHttpResponse(status, "{}", PACKAGE, VERSION),
    ).toEqual({
      kind: "unavailable",
      message: expect.stringContaining(`HTTP ${status}`),
    });
  });

  it("fails closed on HTTP 200 with malformed JSON", () => {
    expect(
      classifyNpmjsPublicationFromHttpResponse(
        200,
        "not-json",
        PACKAGE,
        VERSION,
      ),
    ).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("malformed exact-version JSON"),
    });
  });
});

describe("queryNpmjsExactPackageVersionPublication", () => {
  it("maps network failures to unavailable", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

    await expect(
      queryNpmjsExactPackageVersionPublication(PACKAGE, VERSION, { fetchImpl }),
    ).resolves.toEqual({
      kind: "unavailable",
      message: expect.stringContaining("ENOTFOUND"),
    });
  });

  it("maps fetch timeouts to unavailable", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error("The operation was aborted"));

    await expect(
      queryNpmjsExactPackageVersionPublication(PACKAGE, VERSION, { fetchImpl }),
    ).resolves.toEqual({
      kind: "unavailable",
      message: expect.stringContaining("aborted"),
    });
  });
});

describe.each(["@mergesignal/scan-prep", "@mergesignal/shared"] as const)(
  "classifyNpmjsPackageVersionAvailability (%s)",
  (packageName) => {
    const version = VERSION;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("classifies HTTP 200 exact-version metadata as published", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(
          new Response(manifest({ name: packageName }), { status: 200 }),
        );

      await expect(
        classifyNpmjsPackageVersionAvailability(packageName, version, {
          fetchImpl,
        }),
      ).resolves.toEqual({
        kind: "published",
        version,
      });
    });

    it("classifies HTTP 404 as not_found", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(new Response("{}", { status: 404 }));

      await expect(
        classifyNpmjsPackageVersionAvailability(packageName, version, {
          fetchImpl,
        }),
      ).resolves.toEqual({ kind: "not_found" });
    });
  },
);

describe("readSharedDependencyPinFromNpmjsPackageVersionDocument", () => {
  it("reads the published Shared dependency pin from exact-version metadata", () => {
    expect(
      readSharedDependencyPinFromNpmjsPackageVersionDocument({
        name: PACKAGE,
        version: VERSION,
        dependencies: { "@mergesignal/shared": "0.19.1" },
      }),
    ).toBe("0.19.1");
  });

  it("fails when the Shared dependency pin is missing", () => {
    expect(() =>
      readSharedDependencyPinFromNpmjsPackageVersionDocument({
        name: PACKAGE,
        version: VERSION,
      }),
    ).toThrow(/missing dependencies\.@mergesignal\/shared/);
  });
});
