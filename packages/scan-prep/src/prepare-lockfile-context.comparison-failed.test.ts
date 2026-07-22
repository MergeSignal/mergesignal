import { describe, expect, it, vi } from "vitest";

vi.mock("./lockfile-evidence-comparison.js", () => ({
  compareLockfileEvidence: vi.fn(() => {
    throw new Error("comparison exploded");
  }),
  lockfileComparisonExpected: (job: {
    lockfile?: unknown;
    baseLockfile?: unknown;
    github?: unknown;
  }) =>
    Boolean(
      (job.lockfile && job.baseLockfile) ||
      (job.github && (job.lockfile || job.baseLockfile)),
    ),
}));

import { prepareLockfileContext } from "./prepare-lockfile-context.js";

describe("prepareLockfileContext comparison failure", () => {
  it("maps thrown comparison to comparison_failed with lockfile_diff_failed warning", () => {
    const result = prepareLockfileContext({
      scanId: "comparison-failed",
      repoId: "acme/app",
      dependencyGraph: {},
      baseLockfile: {
        manager: "npm",
        content: JSON.stringify({ lockfileVersion: 3, packages: {} }),
      },
      lockfile: {
        manager: "npm",
        content: JSON.stringify({ lockfileVersion: 3, packages: {} }),
      },
    });

    expect(result.evidenceStatus).toEqual({
      kind: "unavailable",
      reason: "comparison_failed",
    });
    expect(result.changedPackages).toEqual([]);
    expect(result.lockfilePackageDelta).toBeUndefined();
    expect(result.warnings.map((w) => w.code)).toContain(
      "lockfile_diff_failed",
    );
  });
});
