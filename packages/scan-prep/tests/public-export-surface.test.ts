import { describe, expect, it } from "vitest";

import {
  APPROVED_LOCKFILE_RUNTIME,
  APPROVED_LOCKFILE_TYPES,
  APPROVED_PACKAGE_EXPORTS,
  APPROVED_ROOT_RUNTIME,
  APPROVED_ROOT_TYPES,
  PROHIBITED_RUNTIME,
} from "../approved-export-surface.js";
import * as lockfile from "../src/lockfile.js";
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

  it("does not expose prohibited symbols on root or lockfile barrels", () => {
    for (const symbol of PROHIBITED_RUNTIME) {
      expect(root).not.toHaveProperty(symbol);
      expect(lockfile).not.toHaveProperty(symbol);
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
    expect(APPROVED_PACKAGE_EXPORTS).toEqual([".", "./lockfile"]);
  });
});

describe("lockfile subpath resolution", () => {
  it("resolves package.json exports map for ./lockfile", async () => {
    const pkg = await import("../package.json", { with: { type: "json" } });
    expect(Object.keys(pkg.default.exports).sort()).toEqual(
      [...APPROVED_PACKAGE_EXPORTS].sort(),
    );
    const lockfileExport = pkg.default.exports["./lockfile"];
    expect(lockfileExport.import).toBe("./dist/lockfile.js");
    expect(lockfileExport.types).toBe("./dist/lockfile.d.ts");
  });
});
