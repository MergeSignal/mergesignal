import { describe, expect, it, vi } from "vitest";

import {
  classifyNpmjsScanPrepVersionAvailability,
  isConfirmedExactScanPrepVersionNotFound,
} from "../../../scripts/ci/lib/scan-prep-npmjs-version-availability.ts";

const { execFileSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}));

const VERSION = "0.1.1";
const SPEC = "@mergesignal/scan-prep@0.1.1";

function npmError(stderr: string): never {
  const error = new Error("npm command failed") as Error & {
    status?: number;
    stderr?: string;
  };
  error.status = 1;
  error.stderr = stderr;
  throw error;
}

describe("npmjs scan-prep version availability", () => {
  it("classifies an exact published version", () => {
    execFileSyncMock.mockReturnValue("0.1.1\n");

    expect(classifyNpmjsScanPrepVersionAvailability(VERSION)).toEqual({
      kind: "published",
      version: "0.1.1",
    });
    expect(execFileSyncMock).toHaveBeenCalledWith(
      "npm",
      ["view", SPEC, "version", "--registry", "https://registry.npmjs.org/"],
      expect.objectContaining({ encoding: "utf8" }),
    );
  });

  it("classifies a confirmed exact-version npm E404 as not found", () => {
    execFileSyncMock.mockImplementation(() => {
      npmError(
        "npm error code E404\nnpm error 404 No match found for version @mergesignal/scan-prep@0.1.1",
      );
    });

    expect(classifyNpmjsScanPrepVersionAvailability(VERSION)).toEqual({
      kind: "not_found",
    });
  });

  it("classifies a missing package with coherent npm E404 as not found", () => {
    execFileSyncMock.mockImplementation(() => {
      npmError(
        "npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/@mergesignal%2fscan-prep - Not found",
      );
    });

    expect(classifyNpmjsScanPrepVersionAvailability(VERSION)).toEqual({
      kind: "not_found",
    });
  });

  it("fails closed on unrelated error text containing 404 Not Found without npm E404", () => {
    execFileSyncMock.mockImplementation(() => {
      npmError("upstream proxy failure: HTTP 404 Not Found from gateway");
    });

    expect(classifyNpmjsScanPrepVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("404 Not Found"),
    });
    expect(
      isConfirmedExactScanPrepVersionNotFound(
        "upstream proxy failure: HTTP 404 Not Found from gateway",
        VERSION,
      ),
    ).toBe(false);
  });

  it("fails closed on npm E404 for another package", () => {
    execFileSyncMock.mockImplementation(() => {
      npmError(
        "npm error code E404\nnpm error 404 No match found for version @mergesignal/shared@99.99.99",
      );
    });

    expect(classifyNpmjsScanPrepVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("E404"),
    });
  });

  it('fails closed on broad "is not in the registry" text without exact identity', () => {
    execFileSyncMock.mockImplementation(() => {
      npmError("The requested dependency is not in the registry");
    });

    expect(classifyNpmjsScanPrepVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("not in the registry"),
    });
  });

  it("fails closed on registry or network failure", () => {
    execFileSyncMock.mockImplementation(() => {
      npmError("getaddrinfo ENOTFOUND registry.npmjs.org");
    });

    expect(classifyNpmjsScanPrepVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("ENOTFOUND"),
    });
  });

  it("fails closed on authentication or configuration failure", () => {
    execFileSyncMock.mockImplementation(() => {
      npmError("npm error code ENEEDAUTH\nnpm error need auth");
    });

    expect(classifyNpmjsScanPrepVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("ENEEDAUTH"),
    });
  });

  it("fails closed on malformed or unexpected npm output", () => {
    execFileSyncMock.mockReturnValue("not-a-version");

    expect(classifyNpmjsScanPrepVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("unexpected version"),
    });
  });

  it("fails closed on unrelated nonzero npm failures", () => {
    execFileSyncMock.mockImplementation(() => {
      npmError("npm error code ERR_INVALID_ARG_TYPE");
    });

    expect(classifyNpmjsScanPrepVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("ERR_INVALID_ARG_TYPE"),
    });
  });
});
