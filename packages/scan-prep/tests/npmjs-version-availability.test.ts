import { describe, expect, it, vi } from "vitest";

import {
  classifyNpmjsScanPrepVersionAvailability,
  PACKAGE_NAME,
} from "../../../scripts/ci/lib/scan-prep-npmjs-version-availability.ts";

const { execFileSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}));

describe("scan-prep npmjs version availability adapter", () => {
  it("queries structured versions for @mergesignal/scan-prep", () => {
    execFileSyncMock.mockReturnValue('["0.1.9"]\n');

    expect(classifyNpmjsScanPrepVersionAvailability("0.1.9")).toEqual({
      kind: "published",
      version: "0.1.9",
    });
    expect(execFileSyncMock).toHaveBeenCalledWith(
      "npm",
      [
        "view",
        PACKAGE_NAME,
        "versions",
        "--json",
        "--registry",
        "https://registry.npmjs.org/",
      ],
      expect.objectContaining({ encoding: "utf8" }),
    );
  });
});
