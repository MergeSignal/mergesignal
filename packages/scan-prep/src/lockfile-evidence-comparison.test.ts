import { describe, expect, it } from "vitest";

import {
  compareLockfileEvidence,
  lockfileComparisonExpected,
} from "./lockfile-evidence-comparison.js";

const npmV3 = (packages: Record<string, string>) =>
  JSON.stringify({
    lockfileVersion: 3,
    packages: Object.fromEntries(
      Object.entries(packages).map(([name, version]) => [
        name === "" ? "" : `node_modules/${name}`,
        name === "" ? { name: "app" } : { version },
      ]),
    ),
  });

const npmV1 = (dependencies: Record<string, string>) =>
  JSON.stringify({
    name: "app",
    version: "1.0.0",
    lockfileVersion: 1,
    dependencies: Object.fromEntries(
      Object.entries(dependencies).map(([name, version]) => [
        name,
        {
          version,
          resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
        },
      ]),
    ),
  });

const pnpmImporterLock = (deps: Record<string, string>, packages?: string) => {
  const depLines =
    Object.keys(deps).length === 0
      ? "    dependencies: {}"
      : `    dependencies:\n${Object.entries(deps)
          .map(
            ([name, version]) =>
              `      ${name}:\n        specifier: ^${version}\n        version: ${version}`,
          )
          .join("\n")}`;
  const pkgSection = packages ?? "";
  return `lockfileVersion: '9.0'\nimporters:\n  .:\n${depLines}\npackages:\n${pkgSection}`;
};

const pnpmPackagesOnlyLock = (pkgLines: string) =>
  `lockfileVersion: '9.0'\npackages:\n${pkgLines}`;

const yarnClassic = (entries: Array<{ name: string; version: string }>) =>
  entries
    .map((e) => `"${e.name}@${e.version}":\n  version "${e.version}"`)
    .join("\n\n");

describe("compareLockfileEvidence npm completeness", () => {
  it("accepts valid empty package-lock v3", () => {
    const content = npmV3({});
    const result = compareLockfileEvidence({
      baseContent: content,
      headContent: content,
      manager: "npm",
    });
    expect(result.evidenceStatus).toEqual({ kind: "verified", delta: "empty" });
  });

  it("accepts valid changed package-lock v3", () => {
    const result = compareLockfileEvidence({
      baseContent: npmV3({ lodash: "4.17.20" }),
      headContent: npmV3({ lodash: "4.17.21" }),
      manager: "npm",
    });
    expect(result.evidenceStatus).toEqual({
      kind: "verified",
      delta: "changed",
    });
    expect(result.changedPackages).toContain("lodash");
  });

  it("accepts valid package-lock v1 empty and changed", () => {
    const empty = npmV1({});
    expect(
      compareLockfileEvidence({
        baseContent: empty,
        headContent: empty,
        manager: "npm",
      }).evidenceStatus,
    ).toEqual({ kind: "verified", delta: "empty" });

    const changed = compareLockfileEvidence({
      baseContent: npmV1({ lodash: "4.17.20" }),
      headContent: npmV1({ lodash: "4.17.21" }),
      manager: "npm",
    });
    expect(changed.evidenceStatus).toEqual({
      kind: "verified",
      delta: "changed",
    });
  });

  it("rejects invalid JSON, truncated JSON, array root, primitive root, unknown object", () => {
    for (const content of [
      "{not-json",
      '{"lockfileVersion": 3, "packages": {',
      "[]",
      '"string-root"',
      '{"name":"x"}',
    ]) {
      const result = compareLockfileEvidence({
        baseContent: content,
        headContent: content,
        manager: "npm",
      });
      expect(result.evidenceStatus).toEqual({
        kind: "unavailable",
        reason: "incomplete_parse",
      });
      expect(result.lockfilePackageDelta).toBeUndefined();
    }
  });

  it("rejects asymmetric malformed npm base", () => {
    const result = compareLockfileEvidence({
      baseContent: "{bad",
      headContent: npmV3({ lodash: "4.17.21" }),
      manager: "npm",
    });
    expect(result.evidenceStatus).toEqual({
      kind: "unavailable",
      reason: "incomplete_parse",
    });
    expect(result.changedPackages).toEqual([]);
  });
});

describe("compareLockfileEvidence pnpm authority", () => {
  it("verified empty when importer-direct delta is empty despite packages churn", () => {
    const base = pnpmImporterLock(
      {},
      "  lodash@4.17.20:\n    resolution: {integrity: sha512-a}\n",
    );
    const head = pnpmImporterLock(
      {},
      "  lodash@4.17.21:\n    resolution: {integrity: sha512-b}\n",
    );
    const result = compareLockfileEvidence({
      baseContent: base,
      headContent: head,
      manager: "pnpm",
    });
    expect(result.evidenceStatus).toEqual({ kind: "verified", delta: "empty" });
    expect(result.changedPackages).toEqual([]);
  });

  it("verified changed on importer-direct transition", () => {
    const base = pnpmImporterLock(
      { lodash: "4.17.20" },
      "  lodash@4.17.20:\n    resolution: {integrity: sha512-a}\n",
    );
    const head = pnpmImporterLock(
      { lodash: "4.17.21" },
      "  lodash@4.17.21:\n    resolution: {integrity: sha512-b}\n",
    );
    const result = compareLockfileEvidence({
      baseContent: base,
      headContent: head,
      manager: "pnpm",
    });
    expect(result.evidenceStatus).toEqual({
      kind: "verified",
      delta: "changed",
    });
    expect(result.changedPackages).toContain("lodash");
  });

  it("uses packages channel when importers are absent", () => {
    const base = pnpmPackagesOnlyLock(
      "  lodash@4.17.20:\n    resolution: {integrity: sha512-a}\n",
    );
    const head = pnpmPackagesOnlyLock(
      "  lodash@4.17.21:\n    resolution: {integrity: sha512-b}\n",
    );
    const result = compareLockfileEvidence({
      baseContent: base,
      headContent: head,
      manager: "pnpm",
    });
    expect(result.evidenceStatus).toEqual({
      kind: "verified",
      delta: "changed",
    });
  });

  it("rejects partial importer entry", () => {
    const partial = `lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      lodash:\n`;
    const result = compareLockfileEvidence({
      baseContent: partial,
      headContent: partial,
      manager: "pnpm",
    });
    expect(result.evidenceStatus).toEqual({
      kind: "unavailable",
      reason: "incomplete_parse",
    });
  });
});

describe("compareLockfileEvidence yarn completeness", () => {
  it("verified empty and changed Yarn Classic", () => {
    const empty = yarnClassic([{ name: "lodash", version: "4.17.21" }]);
    expect(
      compareLockfileEvidence({
        baseContent: empty,
        headContent: empty,
        manager: "yarn",
      }).evidenceStatus,
    ).toEqual({ kind: "verified", delta: "empty" });

    const changed = compareLockfileEvidence({
      baseContent: yarnClassic([{ name: "lodash", version: "4.17.20" }]),
      headContent: yarnClassic([{ name: "lodash", version: "4.17.21" }]),
      manager: "yarn",
    });
    expect(changed.evidenceStatus).toEqual({
      kind: "verified",
      delta: "changed",
    });
  });

  it("accepts multi-selector header and comments", () => {
    const content = `# yarn lockfile v1\n\n"lodash@^4.17.21, lodash@4.17.21":\n  version "4.17.21"\n`;
    expect(
      compareLockfileEvidence({
        baseContent: content,
        headContent: content,
        manager: "yarn",
      }).evidenceStatus,
    ).toEqual({ kind: "verified", delta: "empty" });
  });

  it("rejects truncated entry, header without version, Berry-like content", () => {
    const truncated = `"lodash@4.17.21":\n  version `;
    const headerOnly = `"lodash@4.17.21":\n  integrity sha512-x\n`;
    const berry = `__metadata:\n  version: 6\n`;
    for (const content of [truncated, headerOnly, berry]) {
      const result = compareLockfileEvidence({
        baseContent: content,
        headContent: content,
        manager: "yarn",
      });
      expect(result.evidenceStatus).toEqual({
        kind: "unavailable",
        reason: "incomplete_parse",
      });
    }
  });
});

describe("lockfileComparisonExpected", () => {
  it("derives expectation from job facts only", () => {
    expect(
      lockfileComparisonExpected({
        lockfile: {},
        baseLockfile: {},
      }),
    ).toBe(true);
    expect(
      lockfileComparisonExpected({
        github: { owner: "a", repo: "b", prNumber: 1 },
        baseLockfile: {},
      }),
    ).toBe(true);
    expect(
      lockfileComparisonExpected({
        github: { owner: "a", repo: "b", prNumber: 1 },
      }),
    ).toBe(false);
    expect(lockfileComparisonExpected({})).toBe(false);
  });
});
