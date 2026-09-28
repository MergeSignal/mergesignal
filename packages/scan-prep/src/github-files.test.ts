import { describe, expect, it } from "vitest";

import { prioritizeRepositoryEvidencePaths } from "./repository-evidence/corpusPolicy.js";

describe("GitHub tree corpus selection uses repository-evidence policy", () => {
  it("filters excluded paths and orders by evidence priority", () => {
    const treePaths = [
      "node_modules/dep/index.ts",
      "dist/bundle.js",
      "src/index.ts",
      "src/auth/login.ts",
      "src/util.ts",
      "README.md",
      "public/assets/app.js",
    ];

    expect(prioritizeRepositoryEvidencePaths(treePaths)).toEqual([
      "src/index.ts",
      "src/auth/login.ts",
      "src/util.ts",
    ]);
  });
});
