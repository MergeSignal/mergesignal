import { describe, expect, it } from "vitest";
import { readRepositoryUrlFromRegistryRaw } from "./registryRawPaths.js";

describe("readRepositoryUrlFromRegistryRaw", () => {
  it("returns repository.url when present", () => {
    expect(
      readRepositoryUrlFromRegistryRaw({
        repository: { url: "https://github.com/foo/bar" },
      }),
    ).toBe("https://github.com/foo/bar");
  });

  it("returns undefined for non-objects and missing paths", () => {
    expect(readRepositoryUrlFromRegistryRaw(null)).toBeUndefined();
    expect(readRepositoryUrlFromRegistryRaw({})).toBeUndefined();
    expect(
      readRepositoryUrlFromRegistryRaw({ repository: {} }),
    ).toBeUndefined();
  });
});
