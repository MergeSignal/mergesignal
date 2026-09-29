import { describe, expect, it, vi } from "vitest";

import {
  classifyNpmjsSharedVersionAvailability,
  SHARED_PACKAGE_NAME,
} from "../../../scripts/ci/lib/shared-npmjs-version-availability.ts";

const { execFileSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}));

const VERSION = "0.20.0";
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

describe("shared npmjs version availability adapter", () => {
  it("classifies a version present in structured npm versions output as published", () => {
    execFileSyncMock.mockReturnValue('["0.19.1","0.20.0"]\n');

    expect(classifyNpmjsSharedVersionAvailability(VERSION)).toEqual({
      kind: "published",
      version: "0.20.0",
    });
    expect(execFileSyncMock).toHaveBeenCalledWith(
      "npm",
      [
        "view",
        SHARED_PACKAGE_NAME,
        "versions",
        "--json",
        "--registry",
        REGISTRY,
      ],
      expect.objectContaining({ encoding: "utf8" }),
    );
  });

  it("classifies a candidate version absent from structured output as not found", () => {
    execFileSyncMock.mockReturnValue('["0.19.1"]\n');

    expect(classifyNpmjsSharedVersionAvailability(VERSION)).toEqual({
      kind: "not_found",
    });
  });

  it("classifies an empty structured version list as not found", () => {
    execFileSyncMock.mockReturnValue("[]\n");

    expect(classifyNpmjsSharedVersionAvailability(VERSION)).toEqual({
      kind: "not_found",
    });
  });

  it("fails closed on registry command failure", () => {
    execFileSyncMock.mockImplementation(() => {
      npmError("getaddrinfo ENOTFOUND registry.npmjs.org");
    });

    expect(classifyNpmjsSharedVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("ENOTFOUND"),
    });
  });

  it("fails closed on authentication failure", () => {
    execFileSyncMock.mockImplementation(() => {
      npmError("npm error code ENEEDAUTH\nnpm error need auth");
    });

    expect(classifyNpmjsSharedVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("ENEEDAUTH"),
    });
  });

  it("fails closed on registry HTTP 5xx", () => {
    execFileSyncMock.mockImplementation(() => {
      npmError(
        "npm error code E500\nnpm error 502 Bad Gateway - GET https://registry.npmjs.org/@mergesignal%2fshared",
      );
    });

    expect(classifyNpmjsSharedVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("E500"),
    });
  });

  it("fails closed on malformed JSON stdout", () => {
    execFileSyncMock.mockReturnValue("not-json");

    expect(classifyNpmjsSharedVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("malformed versions JSON"),
    });
  });

  it("fails closed on unexpected JSON shape", () => {
    execFileSyncMock.mockReturnValue('{"latest":"0.19.1"}');

    expect(classifyNpmjsSharedVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("malformed versions JSON"),
    });
  });

  it("never classifies npm E404 error text as not found without structured proof", () => {
    execFileSyncMock.mockImplementation(() => {
      npmError(
        "npm error code E404\nnpm error 404 No match found for version @mergesignal/shared@0.20.0",
      );
    });

    expect(classifyNpmjsSharedVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("E404"),
    });
  });

  it("fails closed on unrelated nonzero npm failures", () => {
    execFileSyncMock.mockImplementation(() => {
      npmError("npm error code ERR_INVALID_ARG_TYPE");
    });

    expect(classifyNpmjsSharedVersionAvailability(VERSION)).toEqual({
      kind: "unavailable",
      message: expect.stringContaining("ERR_INVALID_ARG_TYPE"),
    });
  });
});
