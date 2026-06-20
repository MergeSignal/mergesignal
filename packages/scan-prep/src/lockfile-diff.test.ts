import { execSync } from "node:child_process";

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

/** Case C: identical importers, packages section churn only */
const transitiveChurnBase = `
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
  octokit@4.0.0:
    resolution: {integrity: sha512-octokit-v4}
`;

const transitiveChurnHead = `
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
  octokit@5.0.0:
    resolution: {integrity: sha512-octokit-v5}
  jsonwebtoken@9.0.0:
    resolution: {integrity: sha512-jwt}
`;

/** Case B: workspace importer fastify bump (PR #27 shape) */
const workspaceFastifyBase = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      typescript:
        specifier: 5.9.2
        version: 5.9.2
  apps/api:
    dependencies:
      fastify:
        specifier: ^5.7.4
        version: 5.7.4
packages:
  fastify@5.7.4:
    resolution: {integrity: sha512-fastify574}
  fastify@5.8.5:
    resolution: {integrity: sha512-fastify585}
`;

const workspaceFastifyHead = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      typescript:
        specifier: 5.9.2
        version: 5.9.2
  apps/api:
    dependencies:
      fastify:
        specifier: ^5.8.5
        version: 5.8.5
packages:
  fastify@5.7.4:
    resolution: {integrity: sha512-fastify574}
  fastify@5.8.5:
    resolution: {integrity: sha512-fastify585}
`;

/** Case C: multiple workspace importers */
const multiWorkspaceBase = `
lockfileVersion: '9.0'
importers:
  apps/api:
    dependencies:
      fastify:
        specifier: ^5.7.4
        version: 5.7.4
  apps/web:
    dependencies:
      next:
        specifier: 14.0.0
        version: 14.0.0
  packages/shared:
    dependencies:
      zod:
        specifier: ^3.22.0
        version: 3.22.0
packages:
  fastify@5.7.4:
    resolution: {integrity: sha512-f1}
  fastify@5.8.5:
    resolution: {integrity: sha512-f2}
  next@14.0.0:
    resolution: {integrity: sha512-n1}
  next@14.1.0:
    resolution: {integrity: sha512-n2}
  zod@3.22.0:
    resolution: {integrity: sha512-z1}
  zod@3.23.0:
    resolution: {integrity: sha512-z2}
`;

const multiWorkspaceHead = `
lockfileVersion: '9.0'
importers:
  apps/api:
    dependencies:
      fastify:
        specifier: ^5.8.5
        version: 5.8.5
  apps/web:
    dependencies:
      next:
        specifier: 14.1.0
        version: 14.1.0
  packages/shared:
    dependencies:
      zod:
        specifier: ^3.23.0
        version: 3.23.0
packages:
  fastify@5.7.4:
    resolution: {integrity: sha512-f1}
  fastify@5.8.5:
    resolution: {integrity: sha512-f2}
  next@14.0.0:
    resolution: {integrity: sha512-n1}
  next@14.1.0:
    resolution: {integrity: sha512-n2}
  zod@3.22.0:
    resolution: {integrity: sha512-z1}
  zod@3.23.0:
    resolution: {integrity: sha512-z2}
`;

/** Case E: non-root importer add/remove/update */
const nonRootImporterBase = `
lockfileVersion: '9.0'
importers:
  tools/cli:
    dependencies:
      chalk:
        specifier: ^4.0.0
        version: 4.1.2
      left-pad:
        specifier: ^1.0.0
        version: 1.0.0
packages:
  chalk@4.1.2:
    resolution: {integrity: sha512-chalk}
  left-pad@1.0.0:
    resolution: {integrity: sha512-lp}
  lodash@4.17.21:
    resolution: {integrity: sha512-lodash}
`;

const nonRootImporterHead = `
lockfileVersion: '9.0'
importers:
  tools/cli:
    dependencies:
      chalk:
        specifier: ^5.0.0
        version: 5.3.0
      lodash:
        specifier: ^4.17.0
        version: 4.17.21
packages:
  chalk@4.1.2:
    resolution: {integrity: sha512-chalk}
  chalk@5.3.0:
    resolution: {integrity: sha512-chalk5}
  left-pad@1.0.0:
    resolution: {integrity: sha512-lp}
  lodash@4.17.21:
    resolution: {integrity: sha512-lodash}
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

describe("pnpm PR-facing package delta (regression)", () => {
  it("Case A: PR #28 canonical lockfiles emit typescript only", () => {
    const changed = detectChangedPackages(pr28Base, pr28Head, "pnpm");
    const delta = detectLockfilePackageDelta(pr28Base, pr28Head, "pnpm");

    expect(changed).toEqual(["typescript"]);
    expect(delta).toEqual({
      added: [],
      removed: [],
      updated: ["typescript"],
    });
    expect(changed.some((name) => name.includes("octokit"))).toBe(false);
    expect(changed.some((name) => name.includes("jsonwebtoken"))).toBe(false);
  });

  it("Case B: production reproduction pair (f993e62 → 55d10d7334) detects typescript", () => {
    const baseSha = "f993e62c6bbed663dae8aac14e9214a7d883e392";
    const headSha = "55d10d73340e23344915b5bce3192b2ef00e633f";

    let baseLockfile: string;
    let headLockfile: string;
    try {
      baseLockfile = execSync(`git show ${baseSha}:pnpm-lock.yaml`, {
        encoding: "utf8",
      });
      headLockfile = execSync(`git show ${headSha}:pnpm-lock.yaml`, {
        encoding: "utf8",
      });
    } catch {
      return;
    }

    const changed = detectChangedPackages(baseLockfile, headLockfile, "pnpm");
    const delta = detectLockfilePackageDelta(
      baseLockfile,
      headLockfile,
      "pnpm",
    );

    expect(changed).toContain("typescript");
    expect(delta.updated).toContain("typescript");
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThan(15);
  });

  it("Case C: transitive packages-section churn does not inflate changedPackages", () => {
    const changed = detectChangedPackages(
      transitiveChurnBase,
      transitiveChurnHead,
      "pnpm",
    );
    const delta = detectLockfilePackageDelta(
      transitiveChurnBase,
      transitiveChurnHead,
      "pnpm",
    );

    expect(changed).toEqual([]);
    expect(delta).toEqual({ added: [], removed: [], updated: [] });
    expect(
      isPnpmLockfileDiffEmpty(transitiveChurnBase, transitiveChurnHead),
    ).toBe(true);
  });

  it("Case D: direct dependency add, remove, and update still detected", () => {
    expect(
      detectLockfilePackageDelta(pnpmBase, pnpmHeadAdded, "pnpm").added,
    ).toEqual(["lodash"]);
    expect(
      detectLockfilePackageDelta(pnpmBase, pnpmHeadRemoved, "pnpm").removed,
    ).toContain("left-pad");
    expect(
      detectLockfilePackageDelta(pnpmBase, pnpmHeadUpdated, "pnpm").updated,
    ).toContain("left-pad");
  });

  it("Case B: workspace importer fastify update emits fastify only", () => {
    const changed = detectChangedPackages(
      workspaceFastifyBase,
      workspaceFastifyHead,
      "pnpm",
    );
    const delta = detectLockfilePackageDelta(
      workspaceFastifyBase,
      workspaceFastifyHead,
      "pnpm",
    );

    expect(changed).toEqual(["fastify"]);
    expect(delta).toEqual({
      added: [],
      removed: [],
      updated: ["fastify"],
    });
    expect(changed).not.toContain("typescript");
  });

  it("Case C: multiple workspace importers emit all direct changes", () => {
    const changed = detectChangedPackages(
      multiWorkspaceBase,
      multiWorkspaceHead,
      "pnpm",
    );
    const delta = detectLockfilePackageDelta(
      multiWorkspaceBase,
      multiWorkspaceHead,
      "pnpm",
    );

    expect(changed.sort()).toEqual(["fastify", "next", "zod"].sort());
    expect(delta.updated.sort()).toEqual(["fastify", "next", "zod"].sort());
    expect(delta.added).toEqual([]);
    expect(delta.removed).toEqual([]);
  });

  it("Case E: non-root importer add, remove, and update detected", () => {
    const delta = detectLockfilePackageDelta(
      nonRootImporterBase,
      nonRootImporterHead,
      "pnpm",
    );
    const changed = detectChangedPackages(
      nonRootImporterBase,
      nonRootImporterHead,
      "pnpm",
    );

    expect(delta.added).toEqual(["lodash"]);
    expect(delta.removed).toEqual(["left-pad"]);
    expect(delta.updated).toEqual(["chalk"]);
    expect(changed.sort()).toEqual(["chalk", "left-pad", "lodash"].sort());
  });

  it("Case F: PR #27 production lockfiles detect fastify (workspace importer)", () => {
    const baseSha = "d6f422fad139ee1e8322eb49d64a9a3a0ae6cdd1";
    const headSha = "ec044b401ad7dbae3c2c9f2a6b21e8370e041d00";

    let baseLockfile: string;
    let headLockfile: string;
    try {
      baseLockfile = execSync(`git show ${baseSha}:pnpm-lock.yaml`, {
        encoding: "utf8",
      });
      headLockfile = execSync(`git show ${headSha}:pnpm-lock.yaml`, {
        encoding: "utf8",
      });
    } catch {
      return;
    }

    const changed = detectChangedPackages(baseLockfile, headLockfile, "pnpm");
    const delta = detectLockfilePackageDelta(
      baseLockfile,
      headLockfile,
      "pnpm",
    );

    expect(changed).toContain("fastify");
    expect(delta.updated).toContain("fastify");
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThan(15);
  });

  it("Case G: PR #28 production lockfiles detect typescript (root importer)", () => {
    const baseSha = "f993e62c6bbed663dae8aac14e9214a7d883e392";
    const headSha = "55d10d73340e23344915b5bce3192b2ef00e633f";

    let baseLockfile: string;
    let headLockfile: string;
    try {
      baseLockfile = execSync(`git show ${baseSha}:pnpm-lock.yaml`, {
        encoding: "utf8",
      });
      headLockfile = execSync(`git show ${headSha}:pnpm-lock.yaml`, {
        encoding: "utf8",
      });
    } catch {
      return;
    }

    const changed = detectChangedPackages(baseLockfile, headLockfile, "pnpm");
    const delta = detectLockfilePackageDelta(
      baseLockfile,
      headLockfile,
      "pnpm",
    );

    expect(changed).toContain("typescript");
    expect(delta.updated).toContain("typescript");
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThan(15);
  });
});
