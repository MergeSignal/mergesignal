import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertNoCrossRepoFileLinks,
  checkNoCrossRepoFileLinks,
} from "../../../scripts/check-no-cross-repo-file-links.ts";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeYaml(path: string, content: string): void {
  writeFileSync(path, content);
}

async function withTempRepo(
  run: (root: string) => void | Promise<void>,
): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), "ms-cross-repo-guard-"));
  try {
    mkdirSync(join(tmp, "packages", "foo"), { recursive: true });
    writeJson(join(tmp, "package.json"), { name: "root", private: true });
    writeYaml(
      join(tmp, "pnpm-workspace.yaml"),
      'packages:\n  - "packages/*"\n',
    );
    writeJson(join(tmp, "packages", "foo", "package.json"), {
      name: "@w/foo",
      version: "0.0.0",
    });
    writeYaml(join(tmp, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    await run(tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

describe("check-no-cross-repo-file-links guard", () => {
  it("passes on the real repository", async () => {
    await expect(assertNoCrossRepoFileLinks(repoRoot)).resolves.toBeUndefined();
  });

  it("fails when root package.json references external file:", async () => {
    await withTempRepo(async (root) => {
      writeJson(join(root, "package.json"), {
        name: "root",
        private: true,
        dependencies: {
          x: "file:../external/pkg",
        },
      });
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.includes("package.json"))).toBe(true);
    });
  });

  it("fails when a workspace package references external file:", async () => {
    await withTempRepo(async (root) => {
      writeJson(join(root, "packages", "foo", "package.json"), {
        name: "@w/foo",
        version: "0.0.0",
        dependencies: {
          eng: "file:../../../mergesignal-engine/packages/contracts",
        },
      });
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  it("fails on external link:", async () => {
    await withTempRepo(async (root) => {
      writeJson(join(root, "package.json"), {
        name: "root",
        private: true,
        dependencies: { x: "link:../external/pkg" },
      });
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  it("fails on absolute external file:", async () => {
    await withTempRepo(async (root) => {
      writeJson(join(root, "package.json"), {
        name: "root",
        private: true,
        dependencies: { x: "file:/tmp/external-mergesignal-pkg" },
      });
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  it("passes on registry semver dependency", async () => {
    await withTempRepo(async (root) => {
      writeJson(join(root, "package.json"), {
        name: "root",
        private: true,
        dependencies: { zod: "^4.4.3" },
      });
      await expect(assertNoCrossRepoFileLinks(root)).resolves.toBeUndefined();
    });
  });

  it("passes on workspace: protocol", async () => {
    await withTempRepo(async (root) => {
      mkdirSync(join(root, "packages", "bar"), { recursive: true });
      writeJson(join(root, "packages", "bar", "package.json"), {
        name: "bar",
        private: true,
        dependencies: { "@w/foo": "workspace:^" },
      });
      await expect(assertNoCrossRepoFileLinks(root)).resolves.toBeUndefined();
    });
  });

  it("passes on in-repo file: and link: targets", async () => {
    await withTempRepo(async (root) => {
      mkdirSync(join(root, "packages", "bar"), { recursive: true });
      writeJson(join(root, "packages", "bar", "package.json"), {
        name: "bar",
        private: true,
        dependencies: {
          a: "file:../foo",
          b: "link:../foo",
        },
      });
      await expect(assertNoCrossRepoFileLinks(root)).resolves.toBeUndefined();
    });
  });

  it("passes on standard apps/* and packages/* workspace patterns", async () => {
    await withTempRepo(async (root) => {
      writeYaml(
        join(root, "pnpm-workspace.yaml"),
        'packages:\n  - "apps/*"\n  - "packages/*"\n',
      );
      await expect(assertNoCrossRepoFileLinks(root)).resolves.toBeUndefined();
    });
  });

  it("fails when pnpm-workspace.yaml escapes repository root", async () => {
    await withTempRepo(async (root) => {
      writeYaml(
        join(root, "pnpm-workspace.yaml"),
        'packages:\n  - "packages/*"\n  - "../mergesignal-engine/packages/*"\n',
      );
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(violations.some((v) => v.includes("pnpm-workspace.yaml"))).toBe(
        true,
      );
    });
  });

  it("fails on brace expansion with external path without lockfile escape", async () => {
    await withTempRepo(async (root) => {
      writeYaml(
        join(root, "pnpm-workspace.yaml"),
        'packages:\n  - "{apps,../external}/*"\n',
      );
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(
        violations.some((v) =>
          v.includes("pattern cannot be proven in-repository"),
        ),
      ).toBe(true);
    });
  });

  it("fails closed on leading glob magic such as **/*", async () => {
    await withTempRepo(async (root) => {
      writeYaml(join(root, "pnpm-workspace.yaml"), 'packages:\n  - "**/*"\n');
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(
        violations.some((v) =>
          v.includes("pattern cannot be proven in-repository"),
        ),
      ).toBe(true);
    });
  });

  it("fails when static prefix escapes repository root", async () => {
    await withTempRepo(async (root) => {
      writeYaml(
        join(root, "pnpm-workspace.yaml"),
        'packages:\n  - "../external/*"\n',
      );
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(
        violations.some((v) => v.includes("escapes repository root")),
      ).toBe(true);
    });
  });

  it("fails on external file: in lockfile importer specifier/version", async () => {
    await withTempRepo(async (root) => {
      writeYaml(
        join(root, "pnpm-lock.yaml"),
        `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      x:
        specifier: file:../engine/packages/contracts
        version: '@fake/contracts@file:../engine/packages/contracts'
packages:
  '@fake/contracts@file:../engine/packages/contracts':
    resolution: {directory: ../engine/packages/contracts, type: directory}
`,
      );
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  it("fails on external link: in lockfile importer", async () => {
    await withTempRepo(async (root) => {
      writeYaml(
        join(root, "pnpm-lock.yaml"),
        `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      x:
        specifier: link:../engine/pkg
        version: link:../engine/pkg
`,
      );
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  it("fails on external resolution.directory in lockfile packages", async () => {
    await withTempRepo(async (root) => {
      writeYaml(
        join(root, "pnpm-lock.yaml"),
        `lockfileVersion: '9.0'
importers:
  .: {}
packages:
  '@mergesignal/contracts@file:../../../mergesignal-engine/packages/contracts':
    resolution:
      directory: ../../../mergesignal-engine/packages/contracts
      type: directory
`,
      );
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  it("fails on escaped lockfile importer key", async () => {
    await withTempRepo(async (root) => {
      writeYaml(
        join(root, "pnpm-lock.yaml"),
        `lockfileVersion: '9.0'
importers:
  .: {}
  ../engine/packages/x: {}
`,
      );
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(
        violations.some((v) => v.includes("importer ../engine/packages/x")),
      ).toBe(true);
    });
  });

  it("passes on internal workspace link in lockfile", async () => {
    await withTempRepo(async (root) => {
      writeYaml(
        join(root, "pnpm-lock.yaml"),
        `lockfileVersion: '9.0'
importers:
  packages/foo: {}
  apps/bar:
    dependencies:
      '@w/foo':
        specifier: workspace:^
        version: link:../../packages/foo
`,
      );
      mkdirSync(join(root, "apps", "bar"), { recursive: true });
      await expect(assertNoCrossRepoFileLinks(root)).resolves.toBeUndefined();
    });
  });

  it("fails when absolute file: is encoded as relative directory climbing outside ROOT", async () => {
    await withTempRepo(async (root) => {
      writeYaml(
        join(root, "pnpm-lock.yaml"),
        `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      x:
        specifier: file:/tmp/ms-external-abs/pkg
        version: abs-pkg@file:../../../../../tmp/ms-external-abs/pkg
packages:
  abs-pkg@file:../../../../../tmp/ms-external-abs/pkg:
    resolution:
      directory: ../../../../../tmp/ms-external-abs/pkg
      type: directory
`,
      );
      const violations = await checkNoCrossRepoFileLinks(root);
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  it("ignores documentation mentioning mergesignal-engine", async () => {
    await withTempRepo(async (root) => {
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(
        join(root, "docs", "note.md"),
        "Clone mergesignal-engine sibling for local co-dev.\n",
      );
      await expect(assertNoCrossRepoFileLinks(root)).resolves.toBeUndefined();
    });
  });
});
