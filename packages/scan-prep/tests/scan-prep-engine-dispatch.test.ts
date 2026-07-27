import { execSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  SCAN_PREP_PACKAGE_NAME,
  SCAN_PREP_RELEASE_EVENT_TYPE,
  buildScanPrepReleaseDispatchPayload,
  releaseTagForVersion,
} from "../../../scripts/ci/lib/scan-prep-engine-dispatch.ts";
import { verifyScanPrepDispatchRecoveryEvidence } from "../../../scripts/ci/verify-scan-prep-dispatch-recovery-evidence.ts";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const WORKFLOW_PATH = path.join(
  REPO_ROOT,
  ".github/workflows/publish-scan-prep.yml",
);
const RECOVERY_EVIDENCE_MODULE_PATH = path.join(
  REPO_ROOT,
  "scripts/ci/verify-scan-prep-dispatch-recovery-evidence.ts",
);

function publishJobSection(workflow: string): string {
  const publishStart = workflow.indexOf("  publish:");
  const dispatchOnlyStart = workflow.indexOf("  dispatch-only:");
  expect(publishStart).toBeGreaterThan(-1);
  expect(dispatchOnlyStart).toBeGreaterThan(publishStart);
  return workflow.slice(publishStart, dispatchOnlyStart);
}

function dispatchOnlyJobSection(workflow: string): string {
  const dispatchOnlyStart = workflow.indexOf("  dispatch-only:");
  expect(dispatchOnlyStart).toBeGreaterThan(-1);
  return workflow.slice(dispatchOnlyStart);
}

const DISPATCH_CLI = path.join(
  REPO_ROOT,
  "scripts/ci/dispatch-scan-prep-package-released.ts",
);

function realRun(command: string, cwd = REPO_ROOT): string {
  return execSync(command, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runInRepository(
  repoDir: string,
  command: string,
  cwd?: string,
): string {
  return execSync(command, {
    cwd: cwd ?? repoDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function writeScanPrepPackageManifest(
  repoDir: string,
  version: string,
): string {
  const packageDir = path.join(repoDir, "packages/scan-prep");
  mkdirSync(packageDir, { recursive: true });
  const packageJsonPath = path.join(packageDir, "package.json");
  writeFileSync(
    packageJsonPath,
    `${JSON.stringify(
      {
        name: SCAN_PREP_PACKAGE_NAME,
        version,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return packageJsonPath;
}

function initHermeticRepository(tempPrefix: string): string {
  const repoDir = mkdtempSync(path.join(tmpdir(), tempPrefix));
  runInRepository(repoDir, "git init");
  runInRepository(repoDir, 'git config user.email "scan-prep@test.local"');
  runInRepository(repoDir, 'git config user.name "Scan Prep Recovery Test"');
  return repoDir;
}

function commitScanPrepPackageVersion(
  repoDir: string,
  version: string,
  commitMessage: string,
): string {
  writeScanPrepPackageManifest(repoDir, version);
  runInRepository(repoDir, "git add .");
  runInRepository(repoDir, `git commit -m ${JSON.stringify(commitMessage)}`);
  return runInRepository(repoDir, "git rev-parse HEAD");
}

function tagAnnotatedRelease(repoDir: string, version: string): void {
  runInRepository(
    repoDir,
    `git tag -a scan-prep-v${version} -m ${JSON.stringify(`scan-prep ${version}`)}`,
  );
}

function createAnnotatedReleaseRepository(version: string): {
  repoDir: string;
  releaseCommitSha: string;
} {
  const repoDir = initHermeticRepository("scan-prep-release-repo-");
  const releaseCommitSha = commitScanPrepPackageVersion(
    repoDir,
    version,
    `release scan-prep ${version}`,
  );
  tagAnnotatedRelease(repoDir, version);
  return { repoDir, releaseCommitSha };
}

function createDivergentRecoveryRepository(): {
  repoDir: string;
  releaseCommitSha: string;
} {
  const repoDir = initHermeticRepository("scan-prep-recovery-repo-");
  const releaseCommitSha = commitScanPrepPackageVersion(
    repoDir,
    "0.1.4",
    "release scan-prep 0.1.4",
  );
  tagAnnotatedRelease(repoDir, "0.1.4");
  commitScanPrepPackageVersion(repoDir, "0.1.5", "advance workspace to 0.1.5");
  return { repoDir, releaseCommitSha };
}

function createTaggedVersionMismatchRepository(): { repoDir: string } {
  const repoDir = initHermeticRepository("scan-prep-mismatch-repo-");
  commitScanPrepPackageVersion(
    repoDir,
    "0.1.5",
    "tagged commit package version mismatch",
  );
  tagAnnotatedRelease(repoDir, "0.1.4");
  return { repoDir };
}

function verifyRecoveryEvidenceInRepository(
  repoDir: string,
  version: string,
): ReturnType<typeof verifyScanPrepDispatchRecoveryEvidence> {
  return verifyScanPrepDispatchRecoveryEvidence(version, {
    run: (command, cwd) => runInRepository(repoDir, command, cwd),
  });
}

function readRecoveryEvidenceModuleSource(): string {
  const resolvedModulePath = path.resolve(RECOVERY_EVIDENCE_MODULE_PATH);
  expect(resolvedModulePath).toBe(
    path.join(
      REPO_ROOT,
      "scripts/ci/verify-scan-prep-dispatch-recovery-evidence.ts",
    ),
  );
  expect(path.basename(resolvedModulePath)).toBe(
    "verify-scan-prep-dispatch-recovery-evidence.ts",
  );

  const source = readFileSync(resolvedModulePath, "utf8");
  expect(source).toContain("verifyScanPrepDispatchRecoveryEvidence");
  expect(source).toContain("git show");
  return source;
}

function assertRecoveryEvidenceModuleAvoidsWorkspaceFilesystemReads(
  source: string,
): void {
  const governanceMessage =
    "current-workspace package metadata is not recovery evidence; use immutable tag-backed git show metadata instead";

  const forbiddenImportPatterns = [
    /from\s+["']node:fs(?:\/promises)?["']/,
    /from\s+["']fs(?:\/promises)?["']/,
    /require\s*\(\s*["']node:fs(?:\/promises)?["']\s*\)/,
    /require\s*\(\s*["']fs(?:\/promises)?["']\s*\)/,
    /import\s*\(\s*["']node:fs(?:\/promises)?["']\s*\)/,
    /import\s*\(\s*["']fs(?:\/promises)?["']\s*\)/,
  ];

  for (const pattern of forbiddenImportPatterns) {
    expect(source, governanceMessage).not.toMatch(pattern);
  }

  const forbiddenFilesystemApis = [
    "readFileSync",
    "readFile(",
    "promises.readFile",
    "createReadStream",
  ] as const;

  for (const api of forbiddenFilesystemApis) {
    expect(source.includes(api), `${governanceMessage} (found ${api})`).toBe(
      false,
    );
  }

  expect(source, governanceMessage).not.toMatch(
    /assertWorkspacePackageVersion/,
  );
  expect(source, governanceMessage).not.toMatch(/assertCurrentWorkspace/);
}

describe("scan-prep engine dispatch payload", () => {
  it("builds the governed release event payload", () => {
    const payload = buildScanPrepReleaseDispatchPayload({
      version: "0.1.4",
      tag: "scan-prep-v0.1.4",
      commitSha: "6b56f6f504c31860c1332312f6c94d0a508c71f7",
    });
    expect(payload).toEqual({
      package: SCAN_PREP_PACKAGE_NAME,
      version: "0.1.4",
      tag: "scan-prep-v0.1.4",
      commit_sha: "6b56f6f504c31860c1332312f6c94d0a508c71f7",
    });
    expect(Object.keys(payload).sort()).toEqual([
      "commit_sha",
      "package",
      "tag",
      "version",
    ]);
  });

  it("rejects malformed versions, ranges, and partial versions", () => {
    expect(() =>
      buildScanPrepReleaseDispatchPayload({
        version: "^0.1.4",
        tag: "scan-prep-v0.1.4",
        commitSha: "6b56f6f504c31860c1332312f6c94d0a508c71f7",
      }),
    ).toThrow(/exact semver/);
    expect(() =>
      buildScanPrepReleaseDispatchPayload({
        version: "latest",
        tag: "scan-prep-vlatest",
        commitSha: "6b56f6f504c31860c1332312f6c94d0a508c71f7",
      }),
    ).toThrow(/exact semver/);
    expect(() =>
      buildScanPrepReleaseDispatchPayload({
        version: "0.1",
        tag: "scan-prep-v0.1",
        commitSha: "6b56f6f504c31860c1332312f6c94d0a508c71f7",
      }),
    ).toThrow(/exact semver/);
  });

  it("rejects mismatched tags and abbreviated commit SHAs", () => {
    expect(() =>
      buildScanPrepReleaseDispatchPayload({
        version: "0.1.4",
        tag: "scan-prep-v0.1.5",
        commitSha: "6b56f6f504c31860c1332312f6c94d0a508c71f7",
      }),
    ).toThrow(/tag must be scan-prep-v0.1.4/);
    expect(() =>
      buildScanPrepReleaseDispatchPayload({
        version: "0.1.4",
        tag: "scan-prep-v0.1.4",
        commitSha: "6b56f6f5",
      }),
    ).toThrow(/full 40-character git SHA/);
  });

  it("derives immutable tag identity for repeated recovery", () => {
    expect(releaseTagForVersion("0.1.4")).toBe("scan-prep-v0.1.4");
    const first = buildScanPrepReleaseDispatchPayload({
      version: "0.1.4",
      tag: "scan-prep-v0.1.4",
      commitSha: "6b56f6f504c31860c1332312f6c94d0a508c71f7",
    });
    const second = buildScanPrepReleaseDispatchPayload({
      version: "0.1.4",
      tag: "scan-prep-v0.1.4",
      commitSha: "6b56f6f504c31860c1332312f6c94d0a508c71f7",
    });
    expect(second).toEqual(first);
  });
});

describe("scan-prep dispatch recovery evidence", () => {
  it("verifies tag-backed evidence for the published 0.1.4 release", () => {
    const { repoDir, releaseCommitSha } =
      createAnnotatedReleaseRepository("0.1.4");

    try {
      expect(runInRepository(repoDir, "git cat-file -t scan-prep-v0.1.4")).toBe(
        "tag",
      );

      const evidence = verifyRecoveryEvidenceInRepository(repoDir, "0.1.4");

      expect(evidence.version).toBe("0.1.4");
      expect(evidence.tag).toBe("scan-prep-v0.1.4");
      expect(evidence.commitSha).toBe(releaseCommitSha);
      expect(evidence.commitSha).toMatch(/^[0-9a-f]{40}$/);

      const taggedCommitManifest = JSON.parse(
        runInRepository(
          repoDir,
          `git show ${evidence.commitSha}:packages/scan-prep/package.json`,
        ),
      ) as { name: string; version: string };
      expect(taggedCommitManifest.name).toBe(SCAN_PREP_PACKAGE_NAME);
      expect(taggedCommitManifest.version).toBe("0.1.4");
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("recovers 0.1.4 when the workspace package version has advanced to 0.1.5", () => {
    const { repoDir, releaseCommitSha } = createDivergentRecoveryRepository();

    try {
      const workspacePackageJsonPath = path.join(
        repoDir,
        "packages/scan-prep/package.json",
      );
      const workspaceManifest = JSON.parse(
        readFileSync(workspacePackageJsonPath, "utf8"),
      ) as { name: string; version: string };
      expect(workspaceManifest).toEqual({
        name: SCAN_PREP_PACKAGE_NAME,
        version: "0.1.5",
      });

      const headManifest = JSON.parse(
        runInRepository(
          repoDir,
          "git show HEAD:packages/scan-prep/package.json",
        ),
      ) as { name: string; version: string };
      expect(headManifest.version).toBe("0.1.5");

      const evidence = verifyRecoveryEvidenceInRepository(repoDir, "0.1.4");

      expect(evidence.version).toBe("0.1.4");
      expect(evidence.tag).toBe("scan-prep-v0.1.4");
      expect(evidence.commitSha).toBe(releaseCommitSha);
      expect(evidence.commitSha).toMatch(/^[0-9a-f]{40}$/);

      const taggedCommitManifest = JSON.parse(
        runInRepository(
          repoDir,
          `git show ${evidence.commitSha}:packages/scan-prep/package.json`,
        ),
      ) as { name: string; version: string };
      expect(taggedCommitManifest.name).toBe(SCAN_PREP_PACKAGE_NAME);
      expect(taggedCommitManifest.version).toBe("0.1.4");
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });

  it("does not read current-workspace package metadata from the filesystem for recovery identity", () => {
    const source = readRecoveryEvidenceModuleSource();
    assertRecoveryEvidenceModuleAvoidsWorkspaceFilesystemReads(source);
  });

  it("rejects malformed recovery versions before dispatch", () => {
    expect(() =>
      verifyScanPrepDispatchRecoveryEvidence("not-a-version"),
    ).toThrow(/exact semver/);
  });

  it("rejects package version mismatch at the tagged commit", () => {
    const { repoDir } = createTaggedVersionMismatchRepository();

    try {
      expect(() =>
        verifyRecoveryEvidenceInRepository(repoDir, "0.1.4"),
      ).toThrow(/must match requested version/);
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });
});

describe("publish-scan-prep workflow dispatch contract", () => {
  it("dispatches only after registry verification and separates recovery from publication", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain("scan-prep-package-released");
    expect(workflow).toContain("dispatch-scan-prep-package-released.ts");
    expect(workflow).toContain(
      "verify-scan-prep-dispatch-recovery-evidence.ts",
    );
    expect(workflow).toContain("dispatch_only");
    expect(workflow).toContain("if: github.event_name == 'push'");
    expect(workflow).toContain(
      "if: github.event_name == 'workflow_dispatch' && inputs.dispatch_only == true",
    );
    expect(workflow).toContain("MERGESIGNAL_ENGINE_DISPATCH_TOKEN");
    expect(workflow).not.toContain("continue-on-error");
  });

  it("keeps dispatch-only recovery separate from publication", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");
    const dispatchOnlyStart = workflow.indexOf("dispatch-only:");
    const dispatchOnlySection = workflow.slice(dispatchOnlyStart);
    expect(dispatchOnlySection).not.toContain("npm publish");
    expect(dispatchOnlySection).not.toContain("id-token: write");
  });

  it("requires publish verification before dispatch in the publication job", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");
    const publishJob = publishJobSection(workflow);
    const publishVerifyIndex = publishJob.indexOf(
      "name: Verify published registry artifact",
    );
    const publishDispatchIndex = publishJob.indexOf(
      "name: Notify engine repository",
      publishVerifyIndex,
    );
    expect(publishVerifyIndex).toBeGreaterThan(-1);
    expect(publishDispatchIndex).toBeGreaterThan(publishVerifyIndex);
    expect(publishJob).toContain("id: verify_registry");
    expect(publishJob).toContain(
      "if: ${{ success() && steps.publish.outcome == 'success' && steps.verify_registry.outcome == 'success' }}",
    );
  });

  it("installs dependencies before recovery evidence verification", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");
    const dispatchOnlyJob = dispatchOnlyJobSection(workflow);
    const installIndex = dispatchOnlyJob.indexOf(
      "name: Install workspace dependencies",
    );
    const evidenceIndex = dispatchOnlyJob.indexOf(
      "verify-scan-prep-dispatch-recovery-evidence.ts",
    );
    expect(installIndex).toBeGreaterThan(-1);
    expect(evidenceIndex).toBeGreaterThan(installIndex);
    expect(
      dispatchOnlyJob.indexOf("pnpm install --frozen-lockfile", installIndex),
    ).toBeGreaterThan(-1);
  });

  it("does not print secrets in the dispatch CLI", () => {
    const source = readFileSync(DISPATCH_CLI, "utf8");
    const consoleLogBlocks = [
      ...source.matchAll(/console\.log\(([\s\S]*?)\);/g),
    ].map((match) => match[1]!);
    for (const block of consoleLogBlocks) {
      expect(block).not.toContain("ghToken");
      expect(block).not.toContain("GH_TOKEN");
      expect(block).not.toContain("secrets.");
    }
    expect(source).toContain("MERGESIGNAL_ENGINE_DISPATCH_TOKEN");
  });

  it("uses the governed event type constant in dispatch implementation", () => {
    expect(SCAN_PREP_RELEASE_EVENT_TYPE).toBe("scan-prep-package-released");
    expect(() =>
      execSync(
        `pnpm -C packages/shared exec tsx ${path.join(REPO_ROOT, "scripts/ci/dispatch-scan-prep-package-released.ts")} --version=0.1.4 --tag=scan-prep-v0.1.4 --commit-sha=6b56f6f504c31860c1332312f6c94d0a508c71f7`,
        {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            MERGESIGNAL_ENGINE_DISPATCH_TOKEN: "",
          },
          stdio: "pipe",
        },
      ),
    ).toThrow(/MERGESIGNAL_ENGINE_DISPATCH_TOKEN is not set/);
  });

  it("fails dispatch when token is missing", () => {
    expect(() =>
      execSync(
        `pnpm -C packages/shared exec tsx ${DISPATCH_CLI} --version=0.1.4 --tag=scan-prep-v0.1.4 --commit-sha=6b56f6f504c31860c1332312f6c94d0a508c71f7`,
        {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            MERGESIGNAL_ENGINE_DISPATCH_TOKEN: "",
          },
          stdio: "pipe",
        },
      ),
    ).toThrow(/MERGESIGNAL_ENGINE_DISPATCH_TOKEN is not set/);
  });
});
