import { describe, expect, it } from "vitest";

import {
  REPOSITORY_EVIDENCE_DEFAULT_GLOB_PATTERNS,
  REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
  REPOSITORY_EVIDENCE_MAX_FILE_BYTES,
  isRepositoryEvidencePathEligible,
  isRepositoryEvidencePathExcluded,
  normalizeRepositoryRelativePath,
  prioritizeRepositoryEvidencePaths,
  repositoryEvidenceFilePriority,
} from "./corpusPolicy.js";

describe("repository evidence corpus policy", () => {
  it("normalizes repository-relative paths", () => {
    expect(normalizeRepositoryRelativePath("./src/a.ts")).toBe("src/a.ts");
    expect(normalizeRepositoryRelativePath("src\\b.ts")).toBe("src/b.ts");
  });

  it("accepts supported source extensions via default globs", () => {
    for (const path of [
      "src/index.ts",
      "src/App.tsx",
      "lib/util.js",
      "routes/page.jsx",
      "tool.mjs",
      "legacy.cjs",
    ]) {
      expect(isRepositoryEvidencePathEligible(path)).toBe(true);
    }
  });

  it("rejects unsupported extensions", () => {
    expect(isRepositoryEvidencePathEligible("src/readme.md")).toBe(false);
  });

  it("preserves legacy glob matching where *.js also matches package.json", () => {
    expect(isRepositoryEvidencePathEligible("package.json")).toBe(true);
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

  it("prioritizes entry and critical paths deterministically", () => {
    const ordered = prioritizeRepositoryEvidencePaths([
      "src/util/helpers.ts",
      "src/auth/session.ts",
      "src/index.ts",
    ]);
    expect(ordered[0]).toBe("src/index.ts");
    expect(ordered[1]).toBe("src/auth/session.ts");
  });

  it("applies governed candidate file cap", () => {
    const paths = Array.from({ length: 20 }, (_, i) => `src/file-${i}.ts`);
    const selected = prioritizeRepositoryEvidencePaths(paths, { maxFiles: 5 });
    expect(selected).toHaveLength(5);
  });

  it("exposes current evidence bounds as governed constants", () => {
    expect(REPOSITORY_EVIDENCE_MAX_FILE_BYTES).toBe(500_000);
    expect(REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES).toBe(1_000);
    expect(REPOSITORY_EVIDENCE_DEFAULT_GLOB_PATTERNS).toContain("*.ts");
  });

  it("scores deeper paths lower than shallow entrypoints", () => {
    expect(repositoryEvidenceFilePriority("src/index.ts")).toBeGreaterThan(
      repositoryEvidenceFilePriority("src/deep/nested/module.ts"),
    );
  });
});
