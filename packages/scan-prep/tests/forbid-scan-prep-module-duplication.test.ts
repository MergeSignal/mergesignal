import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const guardScript = join(
  repoRoot,
  "scripts/ci/forbid-scan-prep-module-duplication.sh",
);

function runGuard(root: string): number {
  try {
    execSync(`bash "${guardScript}"`, {
      env: { ...process.env, MS_FORBID_SCAN_PREP_GUARD_ROOT: root },
      stdio: "pipe",
    });
    return 0;
  } catch (error: unknown) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status: unknown }).status === "number"
        ? (error as { status: number }).status
        : 1;
    return status;
  }
}

describe("forbid-scan-prep-module-duplication guard", () => {
  it("passes on the real repository", () => {
    expect(runGuard(repoRoot)).toBe(0);
  });

  for (const app of ["api", "cli", "web", "worker"] as const) {
    it(`fails when lockfile-diff.ts exists under apps/${app}`, () => {
      const tmp = mkdtempSync(join(tmpdir(), "ms-prep-guard-"));
      try {
        const appDir = join(tmp, "apps", app, "src");
        mkdirSync(appDir, { recursive: true });
        writeFileSync(join(appDir, "lockfile-diff.ts"), "// forbidden\n");
        expect(runGuard(tmp)).toBe(1);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });
  }

  it("passes when apps import @mergesignal/scan-prep without forbidden module filenames", () => {
    const tmp = mkdtempSync(join(tmpdir(), "ms-prep-guard-"));
    try {
      const appDir = join(tmp, "apps", "api", "src");
      mkdirSync(appDir, { recursive: true });
      writeFileSync(
        join(appDir, "webhook.ts"),
        'import { filterChangeRequestChangedSourcePaths } from "@mergesignal/scan-prep/repository-evidence";\n',
      );
      expect(runGuard(tmp)).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
