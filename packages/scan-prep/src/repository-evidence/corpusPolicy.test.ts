import { describe, expect, it } from "vitest";

import {
  REPOSITORY_EVIDENCE_EXCLUDED_PATH_MARKERS,
  REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
  REPOSITORY_EVIDENCE_MAX_FILE_BYTES,
  REPOSITORY_EVIDENCE_SOURCE_EXTENSIONS,
  compareRepositoryRelativePaths,
  isCanonicalRepositoryRelativePath,
  isRepositoryEvidencePathEligible,
  isRepositoryEvidencePathExcluded,
  prioritizeRepositoryEvidencePaths,
  repositoryEvidenceFilePriority,
  terminalRepositorySourceExtension,
} from "./corpusPolicy.js";

describe("repository evidence corpus policy", () => {
  describe("canonical path input contract", () => {
    it("accepts normal repository-relative and root paths", () => {
      expect(isCanonicalRepositoryRelativePath("src/a.ts")).toBe(true);
      expect(isCanonicalRepositoryRelativePath("myfile.ts")).toBe(true);
      expect(
        isCanonicalRepositoryRelativePath("packages/app/src/module.mts"),
      ).toBe(true);
    });

    it("preserves legitimate whitespace and backslash in repository identity", () => {
      expect(isCanonicalRepositoryRelativePath(" myfile.ts")).toBe(true);
      expect(isCanonicalRepositoryRelativePath("src/a.ts ")).toBe(true);
      expect(isCanonicalRepositoryRelativePath("weird\\name.ts")).toBe(true);
      expect(isRepositoryEvidencePathEligible("weird\\name.ts")).toBe(true);
    });

    it("rejects empty, relative-prefix, absolute, and drive-qualified forms", () => {
      expect(isCanonicalRepositoryRelativePath("")).toBe(false);
      expect(isCanonicalRepositoryRelativePath("./src/a.ts")).toBe(false);
      expect(isCanonicalRepositoryRelativePath("/src/a.ts")).toBe(false);
      expect(isCanonicalRepositoryRelativePath("C:\\repo\\a.ts")).toBe(false);
      expect(isRepositoryEvidencePathEligible("./src/a.ts")).toBe(false);
      expect(isRepositoryEvidencePathEligible("/src/a.ts")).toBe(false);
    });
  });

  describe("source extension eligibility", () => {
    it("accepts governed source extensions including nested paths", () => {
      for (const path of [
        "src/index.ts",
        "src/App.tsx",
        "lib/util.js",
        "routes/page.jsx",
        "tool.mjs",
        "legacy.cjs",
        "packages/app/src/module.mts",
        "packages/app/src/module.cts",
      ]) {
        expect(isRepositoryEvidencePathEligible(path)).toBe(true);
      }
    });

    it("rejects non-source and misleading suffix paths", () => {
      expect(isRepositoryEvidencePathEligible("src/readme.md")).toBe(false);
      expect(isRepositoryEvidencePathEligible("package.json")).toBe(false);
      expect(isRepositoryEvidencePathEligible("config.json")).toBe(false);
      expect(isRepositoryEvidencePathEligible("src/types.d.ts")).toBe(false);
      expect(isRepositoryEvidencePathEligible("dist/bundle.js.map")).toBe(
        false,
      );
      expect(isRepositoryEvidencePathEligible("src/App.tsx.bak")).toBe(false);
    });
  });

  it("excludes vendor, build, static, and test directory markers", () => {
    expect(
      isRepositoryEvidencePathExcluded("node_modules/react/index.js"),
    ).toBe(true);
    expect(isRepositoryEvidencePathExcluded("apps/web/.next/server.js")).toBe(
      true,
    );
    expect(isRepositoryEvidencePathExcluded("packages/lib/dist/index.js")).toBe(
      true,
    );
    expect(isRepositoryEvidencePathExcluded("src/__tests__/a.ts")).toBe(true);
    expect(isRepositoryEvidencePathExcluded("spec/unit.ts")).toBe(true);
  });

  describe("evidence priority", () => {
    const sameDepth = "src/module";

    it("applies TypeScript implementable bonus to .ts, .tsx, .mts, and .cts", () => {
      const jsScore = repositoryEvidenceFilePriority(`${sameDepth}.js`);
      for (const ext of [".ts", ".tsx", ".mts", ".cts"]) {
        expect(
          repositoryEvidenceFilePriority(`${sameDepth}${ext}`),
        ).toBeGreaterThan(jsScore);
      }
      expect(
        repositoryEvidenceFilePriority(`${sameDepth}.mts`),
      ).toBeGreaterThan(repositoryEvidenceFilePriority(`${sameDepth}.mjs`));
      expect(isRepositoryEvidencePathEligible("src/types.d.ts")).toBe(false);
    });

    it("ranks entrypoints above same-depth modules", () => {
      expect(repositoryEvidenceFilePriority("src/index.ts")).toBeGreaterThan(
        repositoryEvidenceFilePriority("src/deep/nested/module.ts"),
      );
    });
  });

  it("prioritizes entry and critical paths deterministically", () => {
    const ordered = prioritizeRepositoryEvidencePaths([
      "src/util/helpers.ts",
      "src/auth/session.ts",
      "src/index.ts",
    ]);
    expect(ordered[0]).toBe("src/index.ts");
    expect(ordered[1]).toBe("src/auth/session.ts");
  });

  it("orders equal-priority paths by canonical path regardless of input order", () => {
    const paths = ["src/b.ts", "src/a.ts", "src/c.ts"];
    const forward = prioritizeRepositoryEvidencePaths(paths);
    const shuffled = prioritizeRepositoryEvidencePaths([
      "src/c.ts",
      "src/a.ts",
      "src/b.ts",
    ]);
    expect(forward).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
    expect(shuffled).toEqual(forward);
  });

  it("dedupes exact duplicate canonical paths before capping", () => {
    const paths = ["src/a.ts", "src/a.ts", "src/b.ts", "src/c.ts", "src/c.ts"];
    const selected = prioritizeRepositoryEvidencePaths(paths);
    expect(selected).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
  });

  it("does not collapse distinct path identities", () => {
    expect(
      prioritizeRepositoryEvidencePaths(["src/a.ts", "src\\a.ts"]),
    ).toEqual(["src/a.ts", "src\\a.ts"]);
  });

  it("selects the same governed capped subset for shuffled over-cap candidates", () => {
    const overCap = REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES + 20;
    const candidates = Array.from(
      { length: overCap },
      (_, i) => `src/z/file-${String(i).padStart(5, "0")}.ts`,
    );
    const ordered = prioritizeRepositoryEvidencePaths(candidates);
    const shuffled = prioritizeRepositoryEvidencePaths(
      [...candidates].reverse(),
    );
    expect(shuffled).toEqual(ordered);
    expect(ordered).toHaveLength(REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES);
  });

  it("uses UTF-16 code unit order for path tie-breaks", () => {
    expect(compareRepositoryRelativePaths("src/a.ts", "src/b.ts")).toBeLessThan(
      0,
    );
    expect(
      compareRepositoryRelativePaths("src/b.ts", "src/a.ts"),
    ).toBeGreaterThan(0);
  });

  it("applies fixed governed candidate file cap", () => {
    const overCap = REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES + 50;
    const paths = Array.from(
      { length: overCap },
      (_, i) => `src/file-${String(i).padStart(5, "0")}.ts`,
    );
    expect(prioritizeRepositoryEvidencePaths(paths)).toHaveLength(
      REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
    );
  });

  it("exposes current evidence bounds and governed source extensions", () => {
    expect(REPOSITORY_EVIDENCE_MAX_FILE_BYTES).toBe(500_000);
    expect(REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES).toBe(1_000);
    expect(REPOSITORY_EVIDENCE_SOURCE_EXTENSIONS).toContain(".mts");
    expect(REPOSITORY_EVIDENCE_SOURCE_EXTENSIONS).toContain(".cts");
    expect(terminalRepositorySourceExtension("src/a.d.ts")).toBeNull();
  });

  it("prevents runtime mutation of governed policy collections", () => {
    expect(Object.isFrozen(REPOSITORY_EVIDENCE_SOURCE_EXTENSIONS)).toBe(true);
    expect(Object.isFrozen(REPOSITORY_EVIDENCE_EXCLUDED_PATH_MARKERS)).toBe(
      true,
    );
    expect(() => {
      (
        REPOSITORY_EVIDENCE_SOURCE_EXTENSIONS as readonly string[] & string[]
      ).push(".hack");
    }).toThrow();
  });
});
