import { describe, expect, it } from "vitest";

import { isCanonicalRepositoryRelativePath } from "./corpusPolicy.js";
import {
  filterChangeRequestChangedSourcePaths,
  isChangeRequestChangedSourcePathEligible,
} from "./changeRequestSourcePaths.js";

describe("change-request changed source paths", () => {
  it("requires canonical repository-relative paths", () => {
    expect(isChangeRequestChangedSourcePathEligible("src/index.ts")).toBe(true);
    expect(isChangeRequestChangedSourcePathEligible("./src/index.ts")).toBe(
      false,
    );
    expect(isChangeRequestChangedSourcePathEligible("src\\util.js")).toBe(true);
    expect(isCanonicalRepositoryRelativePath("src/index.ts")).toBe(true);
    expect(isCanonicalRepositoryRelativePath("src\\util.js")).toBe(true);
  });

  it("recognizes governed implementation extensions and rejects .d.ts", () => {
    const files = [
      "src/a.js",
      "src/a.jsx",
      "src/a.mjs",
      "src/a.cjs",
      "src/a.ts",
      "src/a.tsx",
      "src/a.mts",
      "src/a.cts",
    ];
    expect(filterChangeRequestChangedSourcePaths(files)).toEqual(files);
    expect(isChangeRequestChangedSourcePathEligible("src/types.d.ts")).toBe(
      false,
    );
  });

  it("excludes test and spec paths by path patterns, not whole-tree directory markers", () => {
    const files = [
      "src/index.ts",
      "src/index.test.ts",
      "src/index.spec.ts",
      "src/__tests__/index.ts",
      "test/integration.ts",
      "tests/unit.ts",
    ];
    expect(filterChangeRequestChangedSourcePaths(files)).toEqual([
      "src/index.ts",
    ]);
  });

  it("excludes node_modules and declaration-only files", () => {
    expect(
      filterChangeRequestChangedSourcePaths([
        "src/index.ts",
        "node_modules/pkg/index.js",
        "src/types.d.ts",
      ]),
    ).toEqual(["src/index.ts"]);
  });

  it("does not apply full-tree-only directory exclusions such as public/", () => {
    expect(
      filterChangeRequestChangedSourcePaths(["public/site/index.ts"]),
    ).toEqual(["public/site/index.ts"]);
  });

  it("matches webhook changed-file filtering expectations for a PR file list", () => {
    const files = [
      "apps/api/src/routes/githubWebhook.ts",
      "apps/api/src/services/githubFileService.ts",
      "apps/api/src/services/githubFileService.test.ts",
      "packages/shared/src/types.ts",
      "apps/api/package.json",
      "pnpm-lock.yaml",
    ];
    expect(filterChangeRequestChangedSourcePaths(files)).toEqual([
      "apps/api/src/routes/githubWebhook.ts",
      "apps/api/src/services/githubFileService.ts",
      "packages/shared/src/types.ts",
    ]);
  });
});
