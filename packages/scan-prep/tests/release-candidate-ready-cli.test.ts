import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PACKAGE_NAME,
  SCAN_PREP_DIR,
  expectedReleaseCandidatePublicationEvidencePath,
  expectedReleaseCandidateReportPath,
  packScanPrepToDirectory,
  readReleaseCandidatePublicationEvidence,
  writeReleaseCandidateReport,
} from "../../../scripts/ci/lib/scan-prep-pack-artifact.ts";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const ASSERT_CLI = path.join(
  REPO_ROOT,
  "scripts/ci/assert-scan-prep-release-candidate-ready.ts",
);
const WORKFLOW_PATH = path.join(
  REPO_ROOT,
  ".github/workflows/publish-scan-prep.yml",
);

describe("release candidate publication evidence file handoff", () => {
  it("writes parseable publication evidence without lifecycle contamination", () => {
    execSync("pnpm run build", {
      cwd: SCAN_PREP_DIR,
      stdio: "ignore",
    });

    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-publication-evidence-"),
    );
    const packed = packScanPrepToDirectory(outputDir, {
      runBuildAndTest: false,
    });
    writeReleaseCandidateReport(
      expectedReleaseCandidateReportPath(outputDir, packed.version),
      packed,
      {
        artifactValidation: "pass",
        isolatedInstall: "pass",
      },
    );

    const evidencePath = expectedReleaseCandidatePublicationEvidencePath(
      outputDir,
      packed.version,
    );
    const stdout = execSync(
      `pnpm -C packages/shared exec tsx ${ASSERT_CLI} --output-dir=${outputDir} --version=${packed.version} --json-output=${evidencePath}`,
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
      },
    );

    expect(stdout).toContain("assert:scan-prep-release-candidate-ready OK");
    expect(stdout).not.toMatch(/^\s*\{/m);

    const rawEvidence = readFileSync(evidencePath, "utf8");
    expect(rawEvidence.trim().startsWith("{")).toBe(true);
    expect(rawEvidence).not.toContain("pnpm -C packages/shared exec tsx");
    expect(rawEvidence).not.toContain("mergesignal@");

    const evidence = readReleaseCandidatePublicationEvidence(evidencePath);
    expect(realpathSync(evidence.candidatePath)).toBe(
      realpathSync(packed.tarballPath),
    );
    expect(realpathSync(evidence.reportPath)).toBe(
      realpathSync(
        expectedReleaseCandidateReportPath(outputDir, packed.version),
      ),
    );
    expect(evidence.package).toBe(PACKAGE_NAME);
    expect(evidence.version).toBe(packed.version);
    expect(evidence.integrity).toBe(`sha512-${packed.digestSha512}`);
    expect(evidence.digestSha512).toBe(packed.digestSha512);

    rmSync(outputDir, { recursive: true, force: true });
  });

  it("rejects overwriting an existing publication evidence file", () => {
    execSync("pnpm run build", {
      cwd: SCAN_PREP_DIR,
      stdio: "ignore",
    });

    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-publication-evidence-dup-"),
    );
    const packed = packScanPrepToDirectory(outputDir, {
      runBuildAndTest: false,
    });
    writeReleaseCandidateReport(
      expectedReleaseCandidateReportPath(outputDir, packed.version),
      packed,
      {
        artifactValidation: "pass",
        isolatedInstall: "pass",
      },
    );

    const evidencePath = expectedReleaseCandidatePublicationEvidencePath(
      outputDir,
      packed.version,
    );
    const command = `pnpm -C packages/shared exec tsx ${ASSERT_CLI} --output-dir=${outputDir} --version=${packed.version} --json-output=${evidencePath}`;

    execSync(command, { cwd: REPO_ROOT, stdio: "ignore" });
    expect(() =>
      execSync(command, { cwd: REPO_ROOT, stdio: "pipe" }),
    ).toThrow();

    rmSync(outputDir, { recursive: true, force: true });
  });
});

describe("publish-scan-prep workflow publication evidence contract", () => {
  it("reads structured publication evidence from a file instead of pnpm stdout", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain("--json-output=");
    expect(workflow).toContain("publication-evidence.json");
    expect(workflow).toContain("JSON.parse");
    expect(workflow).not.toMatch(
      /EVIDENCE="\$\(pnpm run assert:scan-prep-release-candidate-ready/,
    );
    expect(workflow).not.toMatch(/\|\s*tail\b/);
    expect(workflow).not.toMatch(/\bgrep\b.*candidatePath/);
    expect(workflow).not.toMatch(/\bsed\b.*candidatePath/);
  });
});
