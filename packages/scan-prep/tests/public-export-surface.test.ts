import { describe, expect, it } from "vitest";

import {
  APPROVED_LOCKFILE_RUNTIME,
  APPROVED_LOCKFILE_TYPES,
  APPROVED_PACKAGE_EXPORTS,
  APPROVED_REPOSITORY_EVIDENCE_RUNTIME,
  APPROVED_REPOSITORY_EVIDENCE_TYPES,
  APPROVED_ROOT_RUNTIME,
  APPROVED_ROOT_TYPES,
  PROHIBITED_RUNTIME,
} from "../approved-export-surface.js";
import * as lockfile from "../src/lockfile.js";
import * as repositoryEvidence from "../src/repository-evidence.js";
import * as root from "../src/index.js";

describe("public export surface", () => {
  it("exposes only approved root runtime symbols", () => {
    expect(Object.keys(root).sort()).toEqual([...APPROVED_ROOT_RUNTIME].sort());
  });

  it("exposes exactly approved lockfile subpath runtime symbols", () => {
    expect(Object.keys(lockfile).sort()).toEqual(
      [...APPROVED_LOCKFILE_RUNTIME].sort(),
    );
    for (const symbol of APPROVED_LOCKFILE_RUNTIME) {
      expect(typeof (lockfile as Record<string, unknown>)[symbol]).toBe(
        "function",
      );
    }
  });

  it("exposes exactly approved repository-evidence subpath runtime symbols", () => {
    expect(Object.keys(repositoryEvidence).sort()).toEqual(
      [...APPROVED_REPOSITORY_EVIDENCE_RUNTIME].sort(),
    );
  });

  it("does not expose prohibited symbols on public barrels", () => {
    for (const symbol of PROHIBITED_RUNTIME) {
      expect(root).not.toHaveProperty(symbol);
      expect(lockfile).not.toHaveProperty(symbol);
      expect(repositoryEvidence).not.toHaveProperty(symbol);
    }
  });

  it("keeps canonical expectation lists aligned with API authority tables", () => {
    expect(APPROVED_ROOT_RUNTIME).toEqual(["prepareScanContext"]);
    expect(APPROVED_ROOT_TYPES).toEqual([
      "PrepareScanContextResult",
      "ScanPreparationSummary",
    ]);
    expect(APPROVED_LOCKFILE_RUNTIME).toHaveLength(12);
    expect(APPROVED_LOCKFILE_TYPES).toHaveLength(7);
    expect(APPROVED_REPOSITORY_EVIDENCE_RUNTIME).toHaveLength(9);
    expect(APPROVED_REPOSITORY_EVIDENCE_TYPES).toHaveLength(0);
    expect(APPROVED_PACKAGE_EXPORTS).toEqual([
      ".",
      "./lockfile",
      "./repository-evidence",
    ]);
  });
});

describe("subpath resolution", () => {
  it("resolves package.json exports map for governed subpaths", async () => {
    const pkg = await import("../package.json", { with: { type: "json" } });
    expect(Object.keys(pkg.default.exports).sort()).toEqual(
      [...APPROVED_PACKAGE_EXPORTS].sort(),
    );
    expect(pkg.default.exports["./repository-evidence"].import).toBe(
      "./dist/repository-evidence.js",
    );
  });
});
