import { describe, expect, it } from "vitest";

import {
  collapsePnpmImporterTransitions,
  collectPnpmImporterTransitionFacts,
  resolvePnpmPackageTransitionCollapse,
} from "./pnpm-importer-transitions.js";

const sameTransitionBase = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      typescript:
        specifier: 5.9.2
        version: 5.9.2
  apps/web:
    devDependencies:
      typescript:
        specifier: 5.9.2
        version: 5.9.2
packages:
  typescript@5.9.2:
    resolution: {integrity: sha512-ts592}
`;

const sameTransitionHead = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      typescript:
        specifier: 5.9.3
        version: 5.9.3
  apps/web:
    devDependencies:
      typescript:
        specifier: 5.9.3
        version: 5.9.3
packages:
  typescript@5.9.3:
    resolution: {integrity: sha512-ts593}
`;

const divergentTransitionBase = `
lockfileVersion: '9.0'
importers:
  apps/a:
    devDependencies:
      typescript:
        specifier: 5.8.0
        version: 5.8.0
  apps/b:
    devDependencies:
      typescript:
        specifier: 5.9.2
        version: 5.9.2
packages:
  typescript@5.8.0:
    resolution: {integrity: sha512-ts58}
  typescript@5.9.2:
    resolution: {integrity: sha512-ts592}
`;

const divergentTransitionHead = `
lockfileVersion: '9.0'
importers:
  apps/a:
    devDependencies:
      typescript:
        specifier: 5.9.0
        version: 5.9.0
  apps/b:
    devDependencies:
      typescript:
        specifier: 5.9.3
        version: 5.9.3
packages:
  typescript@5.9.0:
    resolution: {integrity: sha512-ts59}
  typescript@5.9.3:
    resolution: {integrity: sha512-ts593}
`;

const addAndUpdateBase = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies: {}
  packages/new:
    devDependencies: {}
packages:
`;

const addAndUpdateHead = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      lodash:
        specifier: 4.18.0
        version: 4.18.0
  packages/new:
    devDependencies:
      lodash:
        specifier: 4.17.21
        version: 4.17.21
packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-lodash417}
  lodash@4.18.0:
    resolution: {integrity: sha512-lodash418}
`;

const versionAndSpecifierBase = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      prettier:
        specifier: ^3.0.0
        version: 3.0.0
  packages/shared:
    devDependencies:
      prettier:
        specifier: ^3.0.0
        version: 3.0.0
packages:
  prettier@3.0.0:
    resolution: {integrity: sha512-prettier30}
`;

const versionAndSpecifierHead = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      prettier:
        specifier: ^3.1.0
        version: 3.1.0
  packages/shared:
    devDependencies:
      prettier:
        specifier: ^3.0.0
        version: 3.0.0
packages:
  prettier@3.0.0:
    resolution: {integrity: sha512-prettier30}
  prettier@3.1.0:
    resolution: {integrity: sha512-prettier31}
`;

const peerChurnBase = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      typescript:
        specifier: 5.9.2
        version: 5.9.2
      knip:
        specifier: ^5.88.1
        version: 5.88.1(@types/node@22)(typescript@5.9.2)
packages:
  typescript@5.9.2:
    resolution: {integrity: sha512-ts592}
`;

const peerChurnHead = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      typescript:
        specifier: 5.9.3
        version: 5.9.3
      knip:
        specifier: ^5.88.1
        version: 5.88.1(@types/node@22)(typescript@5.9.3)
packages:
  typescript@5.9.3:
    resolution: {integrity: sha512-ts593}
`;

const multiInstalledBase = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      lodash:
        specifier: 4.17.21
        version: 4.17.21
packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-lodash417}
  lodash@4.18.0:
    resolution: {integrity: sha512-lodash418}
`;

const multiInstalledHead = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      lodash:
        specifier: 4.18.0
        version: 4.18.0
packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-lodash417}
  lodash@4.18.0:
    resolution: {integrity: sha512-lodash418}
`;

describe("pnpm importer transition collapse", () => {
  it("collapses identical transitions across workspaces", () => {
    const result = resolvePnpmPackageTransitionCollapse({
      packageName: "typescript",
      baseLockfile: sameTransitionBase,
      headLockfile: sameTransitionHead,
      options: {
        changedPackageJsonFiles: ["package.json", "apps/web/package.json"],
      },
    });

    expect(result.status).toBe("collapsed");
    if (result.status === "collapsed") {
      expect(result.transition).toEqual({
        kind: "version_update",
        fromVersion: "5.9.2",
        toVersion: "5.9.3",
      });
    }
    expect(result.facts).toHaveLength(2);
  });

  it("marks divergent workspace transitions ambiguous", () => {
    const result = resolvePnpmPackageTransitionCollapse({
      packageName: "typescript",
      baseLockfile: divergentTransitionBase,
      headLockfile: divergentTransitionHead,
      options: {
        changedPackageJsonFiles: ["apps/a/package.json", "apps/b/package.json"],
      },
    });

    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.facts.map((fact) => fact.importerKey).sort()).toEqual([
        "apps/a",
        "apps/b",
      ]);
      expect(
        result.facts
          .map((fact) => `${fact.fromVersion}->${fact.toVersion}`)
          .sort(),
      ).toEqual(["5.8.0->5.9.0", "5.9.2->5.9.3"]);
    }
  });

  it("marks add-in-one-workspace and update-in-another ambiguous", () => {
    const result = resolvePnpmPackageTransitionCollapse({
      packageName: "lodash",
      baseLockfile: addAndUpdateBase,
      headLockfile: addAndUpdateHead,
      options: {
        changedPackageJsonFiles: ["package.json", "packages/new/package.json"],
      },
    });

    expect(result.status).toBe("ambiguous");
  });

  it("collapses version update when another workspace has specifier-only churn", () => {
    const result = resolvePnpmPackageTransitionCollapse({
      packageName: "prettier",
      baseLockfile: versionAndSpecifierBase,
      headLockfile: versionAndSpecifierHead,
      options: {
        changedPackageJsonFiles: [
          "package.json",
          "packages/shared/package.json",
        ],
      },
    });

    expect(result.status).toBe("collapsed");
    if (result.status === "collapsed") {
      expect(result.transition).toEqual({
        kind: "version_update",
        fromVersion: "3.0.0",
        toVersion: "3.1.0",
      });
    }
  });

  it("retains genuine typescript upgrade with peer suffix churn on other packages", () => {
    const facts = collectPnpmImporterTransitionFacts({
      packageName: "typescript",
      baseLockfile: peerChurnBase,
      headLockfile: peerChurnHead,
    });
    expect(facts).toEqual([
      {
        importerKey: ".",
        packageName: "typescript",
        fromVersion: "5.9.2",
        toVersion: "5.9.3",
        changeKind: "version_update",
      },
    ]);

    const knipFacts = collectPnpmImporterTransitionFacts({
      packageName: "knip",
      baseLockfile: peerChurnBase,
      headLockfile: peerChurnHead,
    });
    expect(knipFacts).toEqual([]);
  });

  it("collapses importer upgrade when multiple package entries exist", () => {
    const result = resolvePnpmPackageTransitionCollapse({
      packageName: "lodash",
      baseLockfile: multiInstalledBase,
      headLockfile: multiInstalledHead,
    });

    expect(result.status).toBe("collapsed");
    if (result.status === "collapsed") {
      expect(result.transition).toEqual({
        kind: "version_update",
        fromVersion: "4.17.21",
        toVersion: "4.18.0",
      });
    }
  });

  it("collapse helper is deterministic for ambiguous facts", () => {
    const facts = collectPnpmImporterTransitionFacts({
      packageName: "typescript",
      baseLockfile: divergentTransitionBase,
      headLockfile: divergentTransitionHead,
      options: {
        changedPackageJsonFiles: ["apps/a/package.json", "apps/b/package.json"],
      },
    });
    const first = collapsePnpmImporterTransitions(facts);
    const second = collapsePnpmImporterTransitions(facts);
    expect(first).toEqual(second);
  });
});
