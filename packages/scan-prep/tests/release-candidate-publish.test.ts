import { execSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  PACKAGE_NAME,
  SCAN_PREP_DIR,
  assertReleaseCandidateReadyForPublication,
  expectedReleaseCandidateReportPath,
  packScanPrepToDirectory,
  readReleaseCandidateReport,
  writeReleaseCandidateReport,
  type ReleaseCandidateReport,
} from "../../../scripts/ci/lib/scan-prep-pack-artifact.ts";

function writeTamperedReleaseReport(
  reportPath: string,
  packed: ReturnType<typeof packScanPrepToDirectory>,
  tamper: (report: ReleaseCandidateReport) => void,
): void {
  writeReleaseCandidateReport(reportPath, packed, {
    artifactValidation: "pass",
    isolatedInstall: "pass",
  });
  const report = readReleaseCandidateReport(reportPath);
  tamper(report);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

describe("release candidate publication evidence binding", () => {
  let packedFixture: ReturnType<typeof packScanPrepToDirectory>;
  let outputDir: string;

  beforeAll(() => {
    execSync("pnpm run build", {
      cwd: SCAN_PREP_DIR,
      stdio: "ignore",
    });
    outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-publish-evidence-"),
    );
    packedFixture = packScanPrepToDirectory(outputDir, {
      runBuildAndTest: false,
    });
    writeReleaseCandidateReport(
      expectedReleaseCandidateReportPath(outputDir, packedFixture.version),
      packedFixture,
      {
        artifactValidation: "pass",
        isolatedInstall: "pass",
      },
    );
  });

  afterEach(() => {
    if (
      existsSync(
        expectedReleaseCandidateReportPath(outputDir, packedFixture.version),
      )
    ) {
      writeReleaseCandidateReport(
        expectedReleaseCandidateReportPath(outputDir, packedFixture.version),
        packedFixture,
        {
          artifactValidation: "pass",
          isolatedInstall: "pass",
        },
      );
    }
  });

  it("accepts valid report and matching candidate bytes", () => {
    const evidence = assertReleaseCandidateReadyForPublication({
      reportPath: expectedReleaseCandidateReportPath(
        outputDir,
        packedFixture.version,
      ),
      expectedVersion: packedFixture.version,
    });

    expect(evidence.candidatePath).toBe(packedFixture.tarballPath);
    expect(evidence.package).toBe(PACKAGE_NAME);
    expect(evidence.version).toBe(packedFixture.version);
    expect(evidence.integrity).toBe(`sha512-${packedFixture.digestSha512}`);
  });

  it("rejects a missing report", () => {
    expect(() =>
      assertReleaseCandidateReadyForPublication({
        reportPath: path.join(outputDir, "missing.report.json"),
        expectedVersion: packedFixture.version,
      }),
    ).toThrow(/report not found/i);
  });

  it("rejects a missing candidate", () => {
    const reportPath = expectedReleaseCandidateReportPath(
      outputDir,
      packedFixture.version,
    );
    writeTamperedReleaseReport(reportPath, packedFixture, (report) => {
      report.candidatePath = path.join(outputDir, "missing.tgz");
    });

    expect(() =>
      assertReleaseCandidateReadyForPublication({
        reportPath,
        expectedVersion: packedFixture.version,
      }),
    ).toThrow(/candidate tarball not found/i);
  });

  it("rejects a package-name mismatch", () => {
    const reportPath = expectedReleaseCandidateReportPath(
      outputDir,
      packedFixture.version,
    );
    writeTamperedReleaseReport(reportPath, packedFixture, (report) => {
      report.package = "@mergesignal/other";
    });

    expect(() =>
      assertReleaseCandidateReadyForPublication({
        reportPath,
        expectedVersion: packedFixture.version,
      }),
    ).toThrow(/package must be/);
  });

  it("rejects a package-version mismatch", () => {
    const reportPath = expectedReleaseCandidateReportPath(
      outputDir,
      packedFixture.version,
    );
    writeTamperedReleaseReport(reportPath, packedFixture, (report) => {
      report.version = "9.9.9";
    });

    expect(() =>
      assertReleaseCandidateReadyForPublication({
        reportPath,
        expectedVersion: packedFixture.version,
      }),
    ).toThrow(/version must be/);
  });

  it("rejects a candidate-path mismatch", () => {
    const reportPath = expectedReleaseCandidateReportPath(
      outputDir,
      packedFixture.version,
    );
    writeTamperedReleaseReport(reportPath, packedFixture, (report) => {
      report.candidatePath = `${report.candidatePath}.wrong`;
    });

    expect(() =>
      assertReleaseCandidateReadyForPublication({
        reportPath,
        expectedVersion: packedFixture.version,
      }),
    ).toThrow(/candidate tarball not found/i);
  });

  it("rejects a digest or integrity mismatch", () => {
    const reportPath = expectedReleaseCandidateReportPath(
      outputDir,
      packedFixture.version,
    );
    writeTamperedReleaseReport(reportPath, packedFixture, (report) => {
      report.digestSha512 = "invalid";
      report.integrity = "sha512-invalid";
    });

    expect(() =>
      assertReleaseCandidateReadyForPublication({
        reportPath,
        expectedVersion: packedFixture.version,
      }),
    ).toThrow(/digest mismatch|integrity mismatch/i);
  });

  it("rejects unsuccessful validation status", () => {
    const reportPath = expectedReleaseCandidateReportPath(
      outputDir,
      packedFixture.version,
    );
    writeReleaseCandidateReport(reportPath, packedFixture, {
      artifactValidation: "pass",
      isolatedInstall: "pass",
    });
    const report = readReleaseCandidateReport(reportPath);
    writeFileSync(
      reportPath,
      `${JSON.stringify({ ...report, isolatedInstall: "fail" }, null, 2)}\n`,
    );

    expect(() =>
      assertReleaseCandidateReadyForPublication({
        reportPath,
        expectedVersion: packedFixture.version,
      }),
    ).toThrow(/isolatedInstall is not pass/i);
  });
});
