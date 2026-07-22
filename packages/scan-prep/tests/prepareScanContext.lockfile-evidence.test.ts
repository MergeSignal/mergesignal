import type { ScanQueueJob } from "@mergesignal/shared";
import { describe, expect, it } from "vitest";

import { prepareLockfileContext } from "../src/prepare-lockfile-context.js";
import { prepareScanContext } from "../src/prepareScanContext.js";

const github = { owner: "acme", repo: "app", prNumber: 42 };

const pnpmPackagesLock = (
  packages: Array<{ name: string; version: string }>,
): string => {
  const pkgLines = packages
    .map(
      (p) => `  ${p.name}@${p.version}:\n    resolution: {integrity: sha512-x}`,
    )
    .join("\n");
  return `lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies: {}\npackages:\n${pkgLines}\n`;
};

const npmLock = (packages: Record<string, string>): string =>
  JSON.stringify({
    lockfileVersion: 3,
    packages: Object.fromEntries(
      Object.entries(packages).map(([name, version]) => [
        `node_modules/${name}`,
        { version },
      ]),
    ),
  });

const yarnLock = (entries: Array<{ name: string; version: string }>): string =>
  entries
    .map((e) => `"${e.name}@${e.version}":\n  version "${e.version}"`)
    .join("\n\n");

function warningCodes(warnings: Array<{ code: string }>): string[] {
  return warnings.map((w) => w.code);
}

describe("prepareLockfileContext lockfile evidence contract", () => {
  it("verified empty pnpm lockfile pair emits status without lockfile warning", () => {
    const identical = pnpmPackagesLock([
      { name: "lodash", version: "4.17.21" },
    ]);
    const result = prepareLockfileContext({
      scanId: "verified-empty-pnpm",
      repoId: "acme/app",
      dependencyGraph: {},
      github,
      baseLockfile: { manager: "pnpm", content: identical },
      lockfile: { manager: "pnpm", content: identical },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "verified",
      delta: "empty",
    });
    expect(result.changedPackages).toEqual([]);
    expect(result.lockfilePackageDelta).toEqual({
      added: [],
      removed: [],
      updated: [],
    });
    expect(warningCodes(result.warnings)).toEqual([]);
  });

  it("verified empty npm lockfile pair", () => {
    const content = npmLock({ lodash: "4.17.21" });
    const result = prepareLockfileContext({
      scanId: "verified-empty-npm",
      repoId: "acme/app",
      dependencyGraph: {},
      baseLockfile: { manager: "npm", content },
      lockfile: { manager: "npm", content },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "verified",
      delta: "empty",
    });
    expect(warningCodes(result.warnings)).toEqual([]);
  });

  it("verified empty yarn lockfile pair", () => {
    const content = yarnLock([{ name: "lodash", version: "4.17.21" }]);
    const result = prepareLockfileContext({
      scanId: "verified-empty-yarn",
      repoId: "acme/app",
      dependencyGraph: {},
      baseLockfile: { manager: "yarn", content },
      lockfile: { manager: "yarn", content },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "verified",
      delta: "empty",
    });
    expect(warningCodes(result.warnings)).toEqual([]);
  });

  it("verified changed pair", () => {
    const result = prepareLockfileContext({
      scanId: "verified-changed",
      repoId: "acme/app",
      dependencyGraph: {},
      baseLockfile: {
        manager: "npm",
        content: npmLock({ fastify: "4.18.0" }),
      },
      lockfile: {
        manager: "npm",
        content: npmLock({ fastify: "5.0.0" }),
      },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "verified",
      delta: "changed",
    });
    expect(result.changedPackages).toContain("fastify");
    expect(warningCodes(result.warnings)).toEqual([]);
  });

  it("symmetric malformed lockfiles become incomplete without delta", () => {
    const result = prepareLockfileContext({
      scanId: "malformed-symmetric",
      repoId: "acme/app",
      dependencyGraph: {},
      github,
      baseLockfile: { manager: "npm", content: "{not-json" },
      lockfile: { manager: "npm", content: "{also-not-json" },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "unavailable",
      reason: "incomplete_parse",
    });
    expect(result.changedPackages).toEqual([]);
    expect(result.lockfilePackageDelta).toBeUndefined();
    expect(warningCodes(result.warnings)).toContain(
      "lockfile_evidence_incomplete",
    );
  });

  it("symmetric malformed importer sections become incomplete", () => {
    const partialImporter = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      lodash:
`;
    const result = prepareLockfileContext({
      scanId: "partial-importer",
      repoId: "acme/app",
      dependencyGraph: {},
      baseLockfile: { manager: "pnpm", content: partialImporter },
      lockfile: { manager: "pnpm", content: partialImporter },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "unavailable",
      reason: "incomplete_parse",
    });
    expect(result.lockfilePackageDelta).toBeUndefined();
  });

  it("asymmetric malformed base suppresses fabricated additions", () => {
    const result = prepareLockfileContext({
      scanId: "malformed-base",
      repoId: "acme/app",
      dependencyGraph: {},
      github,
      baseLockfile: { manager: "npm", content: "{invalid" },
      lockfile: {
        manager: "npm",
        content: npmLock({ lodash: "4.17.21" }),
      },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "unavailable",
      reason: "incomplete_parse",
    });
    expect(result.changedPackages).toEqual([]);
    expect(result.lockfilePackageDelta).toBeUndefined();
  });

  it("asymmetric malformed head suppresses fabricated removals", () => {
    const result = prepareLockfileContext({
      scanId: "malformed-head",
      repoId: "acme/app",
      dependencyGraph: {},
      github,
      baseLockfile: {
        manager: "npm",
        content: npmLock({ lodash: "4.17.21" }),
      },
      lockfile: { manager: "npm", content: "{invalid" },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "unavailable",
      reason: "incomplete_parse",
    });
    expect(result.changedPackages).toEqual([]);
    expect(result.lockfilePackageDelta).toBeUndefined();
  });

  it("malformed lockfiles emit incomplete without github gate", () => {
    const result = prepareLockfileContext({
      scanId: "malformed-no-github",
      repoId: "acme/app",
      dependencyGraph: {},
      baseLockfile: { manager: "npm", content: "{bad" },
      lockfile: { manager: "npm", content: "{worse" },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "unavailable",
      reason: "incomplete_parse",
    });
    expect(warningCodes(result.warnings)).toContain(
      "lockfile_evidence_incomplete",
    );
  });

  it("missing head on PR emits unavailable status and warning", () => {
    const result = prepareLockfileContext({
      scanId: "missing-head",
      repoId: "acme/app",
      dependencyGraph: {},
      github,
      baseLockfile: {
        manager: "pnpm",
        content: pnpmPackagesLock([{ name: "lodash", version: "4.17.21" }]),
      },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "unavailable",
      reason: "missing_head",
    });
    expect(warningCodes(result.warnings)).toContain("lockfile_head_missing");
  });

  it("missing base on PR emits warning", () => {
    const result = prepareLockfileContext({
      scanId: "missing-base",
      repoId: "acme/app",
      dependencyGraph: {},
      github,
      lockfile: {
        manager: "pnpm",
        content: pnpmPackagesLock([{ name: "lodash", version: "4.17.21" }]),
      },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "unavailable",
      reason: "missing_base",
    });
    expect(warningCodes(result.warnings)).toContain("base_lockfile_missing");
  });

  it("manager mismatch", () => {
    const result = prepareLockfileContext({
      scanId: "manager-mismatch",
      repoId: "acme/app",
      dependencyGraph: {},
      baseLockfile: { manager: "pnpm", content: "lockfileVersion: '9.0'\n" },
      lockfile: { manager: "npm", content: npmLock({ lodash: "4.17.21" }) },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "unavailable",
      reason: "manager_mismatch",
    });
    expect(warningCodes(result.warnings)).toContain("lockfile_diff_skipped");
  });

  it("no lockfile pair is not applicable", () => {
    const result = prepareLockfileContext({
      scanId: "not-applicable",
      repoId: "acme/app",
      dependencyGraph: {},
    });

    expect(result.evidenceStatus).toEqual({ kind: "not_applicable" });
    expect(warningCodes(result.warnings)).toEqual([]);
  });
});

describe("prepareScanContext propagates lockfile evidence status", () => {
  const identical = pnpmPackagesLock([{ name: "lodash", version: "4.17.21" }]);

  it("verified empty propagates status on scan request", async () => {
    const prepared = await prepareScanContext({
      scanId: "prep-empty",
      repoId: "acme/app",
      dependencyGraph: {},
      github,
      baseLockfile: { manager: "pnpm", content: identical },
      lockfile: { manager: "pnpm", content: identical },
      repoSource: {
        provider: "github",
        owner: "acme",
        repo: "app",
        sha: "abc123",
        installationId: 1,
      },
    });

    expect(prepared.scanRequest.lockfileEvidenceStatus).toEqual({
      kind: "verified",
      delta: "empty",
    });
    expect(warningCodes(prepared.warnings)).not.toContain(
      "lockfile_evidence_incomplete",
    );
    expect(warningCodes(prepared.warnings)).not.toContain(
      "lockfile_diff_empty",
    );
  });
});
