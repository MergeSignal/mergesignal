import { describe, expect, it } from "vitest";

import {
  detectChangedPackages,
  detectLockfilePackageDelta,
  resolvePnpmPackageTransitionCollapse,
} from "./lockfile-diff.js";

const workspaceOnlyLodashBase = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      lodash:
        specifier: ^4.17.0
        version: 4.17.21
  packages/shared:
    devDependencies:
      lodash:
        specifier: ^4.17.0
        version: 4.17.21
packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-lodash417}
`;

const workspaceOnlyLodashHead = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      lodash:
        specifier: ^4.17.0
        version: 4.17.21
  packages/shared:
    devDependencies:
      lodash:
        specifier: ^4.18.0
        version: 4.18.0
packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-lodash417}
  lodash@4.18.0:
    resolution: {integrity: sha512-lodash418}
`;

const multiWorkspaceSameDepBase = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      zod:
        specifier: 3.22.0
        version: 3.22.0
  apps/web:
    dependencies:
      zod:
        specifier: 3.22.0
        version: 3.22.0
packages:
  zod@3.22.0:
    resolution: {integrity: sha512-zod22}
`;

const multiWorkspaceSameDepHead = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      zod:
        specifier: 3.23.0
        version: 3.23.0
  apps/web:
    dependencies:
      zod:
        specifier: 3.23.0
        version: 3.23.0
packages:
  zod@3.23.0:
    resolution: {integrity: sha512-zod23}
`;

const divergentWorkspaceVersionsBase = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      chalk:
        specifier: 5.3.0
        version: 5.3.0
  packages/a:
    devDependencies:
      chalk:
        specifier: 5.2.0
        version: 5.2.0
packages:
  chalk@5.2.0:
    resolution: {integrity: sha512-chalk52}
  chalk@5.3.0:
    resolution: {integrity: sha512-chalk53}
`;

const divergentWorkspaceVersionsHead = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      chalk:
        specifier: 5.4.0
        version: 5.4.0
  packages/a:
    devDependencies:
      chalk:
        specifier: 5.2.0
        version: 5.2.0
packages:
  chalk@5.2.0:
    resolution: {integrity: sha512-chalk52}
  chalk@5.4.0:
    resolution: {integrity: sha512-chalk54}
`;

const scopedPackageBase = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      '@scope/pkg':
        specifier: 1.0.0
        version: 1.0.0
packages:
  '@scope/pkg@1.0.0':
    resolution: {integrity: sha512-scoped}
`;

const scopedPackageHead = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      '@scope/pkg':
        specifier: 1.1.0
        version: 1.1.0
packages:
  '@scope/pkg@1.1.0':
    resolution: {integrity: sha512-scoped11}
`;

const npmAliasBase = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      legacy-name:
        specifier: npm:modern-pkg@2.0.0
        version: modern-pkg@2.0.0
packages:
  modern-pkg@2.0.0:
    resolution: {integrity: sha512-modern20}
`;

const npmAliasHead = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      legacy-name:
        specifier: npm:modern-pkg@2.1.0
        version: modern-pkg@2.1.0
packages:
  modern-pkg@2.1.0:
    resolution: {integrity: sha512-modern21}
`;

const malformedImporterBase = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      broken-pkg: broken
packages:
`;

const malformedImporterHead = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      broken-pkg: still-broken
packages:
`;

const packageAddedInWorkspaceBase = `
lockfileVersion: '9.0'
importers:
  packages/new-app:
    dependencies: {}
packages:
`;

const packageAddedInWorkspaceHead = `
lockfileVersion: '9.0'
importers:
  packages/new-app:
    dependencies:
      left-pad:
        specifier: 1.3.0
        version: 1.3.0
packages:
  left-pad@1.3.0:
    resolution: {integrity: sha512-leftpad}
`;

const packageRemovedFromWorkspaceBase = `
lockfileVersion: '9.0'
importers:
  packages/retired:
    dependencies:
      left-pad:
        specifier: 1.3.0
        version: 1.3.0
packages:
  left-pad@1.3.0:
    resolution: {integrity: sha512-leftpad}
`;

const packageRemovedFromWorkspaceHead = `
lockfileVersion: '9.0'
importers:
  packages/retired:
    dependencies: {}
packages:
`;

function expectCollapsedVersionUpdate(
  result: ReturnType<typeof resolvePnpmPackageTransitionCollapse>,
  fromVersion: string,
  toVersion: string,
): void {
  expect(result.status).toBe("collapsed");
  if (result.status === "collapsed") {
    expect(result.transition).toEqual({
      kind: "version_update",
      fromVersion,
      toVersion,
    });
  }
}

describe("workspace importer transition collapse", () => {
  it("detects workspace-only dependency update", () => {
    const manifests = ["packages/shared/package.json"];
    const changed = detectChangedPackages(
      workspaceOnlyLodashBase,
      workspaceOnlyLodashHead,
      "pnpm",
      { changedPackageJsonFiles: manifests },
    );
    expect(changed).toEqual(["lodash"]);

    const result = resolvePnpmPackageTransitionCollapse({
      packageName: "lodash",
      baseLockfile: workspaceOnlyLodashBase,
      headLockfile: workspaceOnlyLodashHead,
      options: { changedPackageJsonFiles: manifests },
    });
    expectCollapsedVersionUpdate(result, "4.17.21", "4.18.0");
  });

  it("collapses same dependency changed in several workspaces", () => {
    const manifests = ["package.json", "apps/web/package.json"];
    const changed = detectChangedPackages(
      multiWorkspaceSameDepBase,
      multiWorkspaceSameDepHead,
      "pnpm",
      { changedPackageJsonFiles: manifests },
    );
    expect(changed).toEqual(["zod"]);

    const result = resolvePnpmPackageTransitionCollapse({
      packageName: "zod",
      baseLockfile: multiWorkspaceSameDepBase,
      headLockfile: multiWorkspaceSameDepHead,
      options: { changedPackageJsonFiles: manifests },
    });
    expectCollapsedVersionUpdate(result, "3.22.0", "3.23.0");
  });

  it("collapses when only one touched workspace importer changes version", () => {
    const manifests = ["package.json", "packages/a/package.json"];
    const changed = detectChangedPackages(
      divergentWorkspaceVersionsBase,
      divergentWorkspaceVersionsHead,
      "pnpm",
      { changedPackageJsonFiles: manifests },
    );
    expect(changed).toEqual(["chalk"]);

    const result = resolvePnpmPackageTransitionCollapse({
      packageName: "chalk",
      baseLockfile: divergentWorkspaceVersionsBase,
      headLockfile: divergentWorkspaceVersionsHead,
      options: { changedPackageJsonFiles: manifests },
    });
    expectCollapsedVersionUpdate(result, "5.3.0", "5.4.0");
  });

  it("resolves scoped package transitions", () => {
    const changed = detectChangedPackages(
      scopedPackageBase,
      scopedPackageHead,
      "pnpm",
    );
    expect(changed).toEqual(["@scope/pkg"]);

    const result = resolvePnpmPackageTransitionCollapse({
      packageName: "@scope/pkg",
      baseLockfile: scopedPackageBase,
      headLockfile: scopedPackageHead,
    });
    expectCollapsedVersionUpdate(result, "1.0.0", "1.1.0");
  });

  it("resolves npm alias importer keys without inventing target package names", () => {
    const changed = detectChangedPackages(npmAliasBase, npmAliasHead, "pnpm");
    expect(changed).toEqual(["legacy-name"]);
    expect(changed).not.toContain("modern-pkg");

    const result = resolvePnpmPackageTransitionCollapse({
      packageName: "legacy-name",
      baseLockfile: npmAliasBase,
      headLockfile: npmAliasHead,
    });
    expectCollapsedVersionUpdate(
      result,
      "modern-pkg@2.0.0",
      "modern-pkg@2.1.0",
    );
  });

  it("returns none for malformed importer values without throwing", () => {
    const result = resolvePnpmPackageTransitionCollapse({
      packageName: "broken-pkg",
      baseLockfile: malformedImporterBase,
      headLockfile: malformedImporterHead,
    });
    expect(result.status).toBe("none");
  });

  it("detects package addition in a workspace importer", () => {
    const manifests = ["packages/new-app/package.json"];
    const delta = detectLockfilePackageDelta(
      packageAddedInWorkspaceBase,
      packageAddedInWorkspaceHead,
      "pnpm",
      { changedPackageJsonFiles: manifests },
    );
    expect(delta.added).toEqual(["left-pad"]);

    const result = resolvePnpmPackageTransitionCollapse({
      packageName: "left-pad",
      baseLockfile: packageAddedInWorkspaceBase,
      headLockfile: packageAddedInWorkspaceHead,
      options: { changedPackageJsonFiles: manifests },
    });
    expect(result.status).toBe("collapsed");
    if (result.status === "collapsed") {
      expect(result.transition).toEqual({
        kind: "added",
        fromVersion: "0.0.0",
        toVersion: "1.3.0",
      });
    }
  });

  it("detects package removal in a workspace importer", () => {
    const manifests = ["packages/retired/package.json"];
    const delta = detectLockfilePackageDelta(
      packageRemovedFromWorkspaceBase,
      packageRemovedFromWorkspaceHead,
      "pnpm",
      { changedPackageJsonFiles: manifests },
    );
    expect(delta.removed).toEqual(["left-pad"]);
  });
});
