import { describe, expect, it } from "vitest";

import { filterChangeRequestChangedSourcePaths } from "./changeRequestSourcePaths.js";

describe("change-request changed source paths", () => {
  it("includes TypeScript and JavaScript source extensions", () => {
    const files = [
      "src/index.ts",
      "src/utils.js",
      "src/component.tsx",
      "src/page.jsx",
      "lib/helper.mjs",
      "lib/module.cjs",
      "types/config.mts",
      "types/config.cts",
    ];
    expect(filterChangeRequestChangedSourcePaths(files)).toEqual(files);
  });

  it("excludes test and spec paths", () => {
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

  it("matches API githubFileService expectations for a PR file list", () => {
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
