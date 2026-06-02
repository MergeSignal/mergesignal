import { describe, expect, it } from "vitest";

import {
  detectChangedPackages,
  detectLockfilePackageDelta,
} from "./lockfile-diff.js";

const pnpmBase = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      left-pad:
        specifier: ^1.0.0
        version: 1.0.0
packages:
  left-pad@1.0.0:
    resolution: {integrity: sha512-test}
`;

const pnpmHeadAdded = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      left-pad:
        specifier: ^1.0.0
        version: 1.0.0
      lodash:
        specifier: ^4.17.0
        version: 4.17.21
packages:
  left-pad@1.0.0:
    resolution: {integrity: sha512-test}
  lodash@4.17.21:
    resolution: {integrity: sha512-test}
`;

const pnpmHeadRemoved = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies: {}
packages:
`;

const pnpmHeadUpdated = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      left-pad:
        specifier: ^1.0.0
        version: 1.0.1
packages:
  left-pad@1.0.1:
    resolution: {integrity: sha512-test2}
`;

const pnpmHeadMulti = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      left-pad:
        specifier: ^1.0.0
        version: 1.0.1
      lodash:
        specifier: ^4.17.0
        version: 4.17.21
packages:
  left-pad@1.0.1:
    resolution: {integrity: sha512-test2}
  lodash@4.17.21:
    resolution: {integrity: sha512-test}
`;

describe("detectLockfilePackageDelta", () => {
  it("detects added package", () => {
    const delta = detectLockfilePackageDelta(pnpmBase, pnpmHeadAdded, "pnpm");
    expect(delta.added).toEqual(["lodash"]);
    expect(delta.removed).toEqual([]);
    expect(delta.updated).toEqual([]);
    expect(detectChangedPackages(pnpmBase, pnpmHeadAdded, "pnpm")).toContain(
      "lodash",
    );
  });

  it("detects removed package", () => {
    const delta = detectLockfilePackageDelta(pnpmBase, pnpmHeadRemoved, "pnpm");
    expect(delta.removed).toContain("left-pad");
    expect(delta.added).toEqual([]);
  });

  it("detects upgraded package", () => {
    const delta = detectLockfilePackageDelta(pnpmBase, pnpmHeadUpdated, "pnpm");
    expect(delta.updated).toContain("left-pad");
    expect(delta.added).toEqual([]);
    expect(delta.removed).toEqual([]);
  });

  it("detects multiple package changes", () => {
    const delta = detectLockfilePackageDelta(pnpmBase, pnpmHeadMulti, "pnpm");
    expect(delta.added).toContain("lodash");
    expect(delta.updated).toContain("left-pad");
    expect(
      detectChangedPackages(pnpmBase, pnpmHeadMulti, "pnpm").sort(),
    ).toEqual(["left-pad", "lodash"].sort());
  });
});
