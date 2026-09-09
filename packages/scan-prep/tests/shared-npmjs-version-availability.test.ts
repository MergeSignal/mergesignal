import { describe, expect, it, vi } from "vitest";

import {
  classifyNpmjsSharedVersionAvailability,
  isConfirmedExactSharedVersionNotFound,
} from "../../../scripts/ci/lib/shared-npmjs-version-availability.ts";

const { execFileSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}));

const VERSION = "0.18.0";
const SPEC = "@mergesignal/shared@0.18.0";

function npmError(stderr: string): never {
  const error = new Error("npm command failed") as Error & {
    status?: number;
    stderr?: string;
  };
  error.status = 1;
  error.stderr = stderr;
  throw error;
}

describe("npmjs shared version availability", () => {
  it("classifies an exact published version", () => {
    execFileSyncMock.mockReturnValue("0.18.0\n");

    expect(classifyNpmjsSharedVersionAvailability(VERSION)).toEqual({
      kind: "published",
      version: "0.18.0",
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
        "npm error code E404\nnpm error 404 No match found for version @mergesignal/shared@0.18.0",
      );
    });

    expect(classifyNpmjsSharedVersionAvailability(VERSION)).toEqual({
      kind: "not_found",
    });
  });

  it("detects coherent shared E404 output", () => {
    expect(
      isConfirmedExactSharedVersionNotFound(
        "npm error code E404\nnpm error 404 No match found for version @mergesignal/shared@0.18.0",
        VERSION,
      ),
    ).toBe(true);
  });
});
