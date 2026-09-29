import { describe, expect, it, vi } from "vitest";

import {
  classifyNpmjsPackageVersionAvailability,
  parseNpmPublishedVersionsJson,
} from "../../../scripts/ci/lib/npmjs-package-version-availability.ts";

const { execFileSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}));

const VERSION = "8.8.8-test";
const REGISTRY = "https://registry.npmjs.org/";

function npmError(stderr: string): never {
  const error = new Error("npm command failed") as Error & {
    status?: number;
    stderr?: string;
  };
  error.status = 1;
  error.stderr = stderr;
  throw error;
}

function expectNpmVersionsQuery(packageName: string): void {
  expect(execFileSyncMock).toHaveBeenCalledWith(
    "npm",
    ["view", packageName, "versions", "--json", "--registry", REGISTRY],
    expect.objectContaining({ encoding: "utf8" }),
  );
}

describe("parseNpmPublishedVersionsJson", () => {
  it("accepts a JSON array of version strings", () => {
    expect(parseNpmPublishedVersionsJson('["0.1.0","0.1.1"]')).toEqual([
      "0.1.0",
      "0.1.1",
    ]);
  });

  it("accepts a single published version as a JSON string", () => {
    expect(parseNpmPublishedVersionsJson('"0.1.9"')).toEqual(["0.1.9"]);
  });

  it("rejects malformed JSON", () => {
    expect(parseNpmPublishedVersionsJson("not-json")).toBeNull();
  });

  it("rejects unexpected JSON shapes", () => {
    expect(parseNpmPublishedVersionsJson('{"versions":["0.1.0"]}')).toBeNull();
    expect(parseNpmPublishedVersionsJson("[1,2]")).toBeNull();
  });

  it("treats an empty JSON array as a valid empty version list", () => {
    expect(parseNpmPublishedVersionsJson("[]")).toEqual([]);
  });
});

describe.each(["@mergesignal/scan-prep", "@mergesignal/shared"] as const)(
  "classifyNpmjsPackageVersionAvailability (%s)",
  (packageName) => {
    it("classifies a version present in structured npm versions output as published", () => {
      execFileSyncMock.mockReturnValue(`["0.1.0","${VERSION}"]\n`);

      expect(
        classifyNpmjsPackageVersionAvailability(packageName, VERSION),
      ).toEqual({
        kind: "published",
        version: VERSION,
      });
      expectNpmVersionsQuery(packageName);
    });

    it("classifies a version absent from structured npm versions output as not found", () => {
      execFileSyncMock.mockReturnValue('["0.1.0"]\n');

      expect(
        classifyNpmjsPackageVersionAvailability(packageName, VERSION),
      ).toEqual({
        kind: "not_found",
      });
    });

    it("classifies an empty structured version list as not found for the requested version", () => {
      execFileSyncMock.mockReturnValue("[]\n");

      expect(
        classifyNpmjsPackageVersionAvailability(packageName, VERSION),
      ).toEqual({
        kind: "not_found",
      });
    });

    it("fails closed on registry command failure", () => {
      execFileSyncMock.mockImplementation(() => {
        npmError("getaddrinfo ENOTFOUND registry.npmjs.org");
      });

      expect(
        classifyNpmjsPackageVersionAvailability(packageName, VERSION),
      ).toEqual({
        kind: "unavailable",
        message: expect.stringContaining("ENOTFOUND"),
      });
    });

    it("fails closed on authentication failure", () => {
      execFileSyncMock.mockImplementation(() => {
        npmError("npm error code ENEEDAUTH\nnpm error need auth");
      });

      expect(
        classifyNpmjsPackageVersionAvailability(packageName, VERSION),
      ).toEqual({
        kind: "unavailable",
        message: expect.stringContaining("ENEEDAUTH"),
      });
    });

    it("fails closed on registry HTTP 5xx", () => {
      execFileSyncMock.mockImplementation(() => {
        npmError(
          `npm error code E500\nnpm error 502 Bad Gateway - GET https://registry.npmjs.org/${packageName.replace("/", "%2f")}`,
        );
      });

      expect(
        classifyNpmjsPackageVersionAvailability(packageName, VERSION),
      ).toEqual({
        kind: "unavailable",
        message: expect.stringContaining("E500"),
      });
    });

    it("fails closed on malformed JSON stdout", () => {
      execFileSyncMock.mockReturnValue("not-json");

      expect(
        classifyNpmjsPackageVersionAvailability(packageName, VERSION),
      ).toEqual({
        kind: "unavailable",
        message: expect.stringContaining("malformed versions JSON"),
      });
    });

    it("fails closed on unexpected JSON shape", () => {
      execFileSyncMock.mockReturnValue('{"latest":"0.1.0"}');

      expect(
        classifyNpmjsPackageVersionAvailability(packageName, VERSION),
      ).toEqual({
        kind: "unavailable",
        message: expect.stringContaining("malformed versions JSON"),
      });
    });

    it("never classifies npm E404 error text as not found without structured proof", () => {
      execFileSyncMock.mockImplementation(() => {
        npmError(
          `npm error code E404\nnpm error 404 No match found for version ${packageName}@${VERSION}`,
        );
      });

      expect(
        classifyNpmjsPackageVersionAvailability(packageName, VERSION),
      ).toEqual({
        kind: "unavailable",
        message: expect.stringContaining("E404"),
      });
    });

    it("fails closed on unrelated nonzero npm failures", () => {
      execFileSyncMock.mockImplementation(() => {
        npmError("npm error code ERR_INVALID_ARG_TYPE");
      });

      expect(
        classifyNpmjsPackageVersionAvailability(packageName, VERSION),
      ).toEqual({
        kind: "unavailable",
        message: expect.stringContaining("ERR_INVALID_ARG_TYPE"),
      });
    });
  },
);
