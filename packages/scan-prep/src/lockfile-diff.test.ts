import { describe, expect, it } from "vitest";

import {
  detectChangedPackages,
  detectLockfilePackageDelta,
  isPnpmLockfileDiffEmpty,
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

/** PR #28 shape: dual typescript versions in packages, importer bump 5.9.2 → 5.9.3 */
const pr28Base = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      typescript:
        specifier: 5.9.2
        version: 5.9.2
packages:
  typescript@5.9.2:
    resolution: {integrity: sha512-ts592}
  typescript@5.9.3:
    resolution: {integrity: sha512-ts593}
`;

const pr28Head = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      typescript:
        specifier: 5.9.3
        version: 5.9.3
packages:
  typescript@5.9.2:
    resolution: {integrity: sha512-ts592}
  typescript@5.9.3:
    resolution: {integrity: sha512-ts593}
`;

const pr28SameImporterDualPackages = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      typescript:
        specifier: 5.9.2
        version: 5.9.2
packages:
  typescript@5.9.2:
    resolution: {integrity: sha512-ts592}
  typescript@5.9.3:
    resolution: {integrity: sha512-ts593}
`;

const pnpmSpecifierOnlyHead = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      left-pad:
        specifier: ~1.0.0
        version: 1.0.0
packages:
  left-pad@1.0.0:
    resolution: {integrity: sha512-test}
`;

const pnpmOptionalAddedHead = `
lockfileVersion: '9.0'
importers:
  .:
    optionalDependencies:
      fsevents:
        specifier: ^2.3.0
        version: 2.3.3
packages:
  fsevents@2.3.3:
    resolution: {integrity: sha512-opt}
`;

const pnpmPackagesOnlyBase = `lockfileVersion: '9.0'
packages:
  typescript@5.9.2:
    resolution: {integrity: sha512-x}
`;

const pnpmPackagesOnlyHead = `lockfileVersion: '9.0'
packages:
  typescript@5.9.3:
    resolution: {integrity: sha512-y}
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

  it("detects PR #28 typescript patch despite dual package entries", () => {
    const delta = detectLockfilePackageDelta(pr28Base, pr28Head, "pnpm");
    expect(delta.updated).toContain("typescript");
    expect(delta.added).toEqual([]);
    expect(delta.removed).toEqual([]);
    expect(detectChangedPackages(pr28Base, pr28Head, "pnpm")).toContain(
      "typescript",
    );
    expect(isPnpmLockfileDiffEmpty(pr28Base, pr28Head)).toBe(false);
  });

  it("does not false-positive when dual package versions match on both sides", () => {
    const delta = detectLockfilePackageDelta(
      pr28SameImporterDualPackages,
      pr28SameImporterDualPackages,
      "pnpm",
    );
    expect(delta).toEqual({ added: [], removed: [], updated: [] });
    expect(
      isPnpmLockfileDiffEmpty(
        pr28SameImporterDualPackages,
        pr28SameImporterDualPackages,
      ),
    ).toBe(true);
  });

  it("detects specifier-only importer change", () => {
    const delta = detectLockfilePackageDelta(
      pnpmBase,
      pnpmSpecifierOnlyHead,
      "pnpm",
    );
    expect(delta.updated).toContain("left-pad");
  });

  it("detects optionalDependencies added on root importer", () => {
    const delta = detectLockfilePackageDelta(
      pnpmBase,
      pnpmOptionalAddedHead,
      "pnpm",
    );
    expect(delta.added).toContain("fsevents");
  });

  it("detects packages-only lockfiles without importers section", () => {
    const delta = detectLockfilePackageDelta(
      pnpmPackagesOnlyBase,
      pnpmPackagesOnlyHead,
      "pnpm",
    );
    expect(delta.updated).toContain("typescript");
    expect(
      detectChangedPackages(pnpmPackagesOnlyBase, pnpmPackagesOnlyHead, "pnpm"),
    ).toContain("typescript");
  });
});
