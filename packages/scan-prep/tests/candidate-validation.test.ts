import { execSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  PACKAGE_NAME,
  PACK_IN_PROGRESS_ENV,
  SCAN_PREP_DIR,
  assertCandidateDigestUnchanged,
  assertPackedScanPrepArtifactValid,
  assertReleaseCandidateEvidenceCoherent,
  assertReleaseOutputDirectoryReady,
  digestSha512OfFile,
  loadScanPrepCandidateFromTarball,
  packScanPrepToDirectory,
  parseCandidateArg,
  readSourceManifest,
  readSourcePackageJsonRaw,
  readReleaseCandidateReport,
  releaseCandidateReportPath,
  releaseCandidateTarballName,
  resolveCanonicalReportPath,
  validatePackedScanPrepArtifact,
  writeAndAssertReleaseCandidateEvidenceCoherent,
  writeReleaseCandidateReport,
  type ReleaseCandidateReport,
} from "../../../scripts/ci/lib/scan-prep-pack-artifact.ts";
import * as isolatedInstall from "../../../scripts/ci/lib/scan-prep-isolated-install.ts";

function createTarballWithManifest(
  outputPath: string,
  manifest: Record<string, unknown>,
): void {
  const workDir = mkdtempSync(path.join(tmpdir(), "ms-scan-prep-fake-pack-"));
  const packageDir = path.join(workDir, "package");
  execSync(`mkdir -p "${packageDir}"`, { stdio: "ignore" });
  writeFileSync(
    path.join(packageDir, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  execSync(`tar -czf "${outputPath}" -C "${workDir}" package`, {
    stdio: "ignore",
  });
  rmSync(workDir, { recursive: true, force: true });
}

function writeValidReleaseReport(
  reportPath: string,
  packed: ReturnType<typeof loadScanPrepCandidateFromTarball>,
): void {
  writeReleaseCandidateReport(reportPath, packed, {
    artifactValidation: "pass",
    isolatedInstall: "pass",
  });
}

function writeTamperedReleaseReport(
  reportPath: string,
  packed: ReturnType<typeof loadScanPrepCandidateFromTarball>,
  tamper: (report: ReleaseCandidateReport) => void,
): void {
  writeValidReleaseReport(reportPath, packed);
  const report = readReleaseCandidateReport(reportPath);
  tamper(report);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

describe("scan-prep candidate validation", () => {
  let packedCandidatePath: string;
  let packInProgressPrevious: string | undefined;

  beforeAll(() => {
    execSync("pnpm run build", {
      cwd: SCAN_PREP_DIR,
      stdio: "ignore",
    });
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-fixture-"),
    );
    const packed = packScanPrepToDirectory(outputDir, {
      runBuildAndTest: false,
    });
    packedCandidatePath = packed.tarballPath;
  });

  afterEach(() => {
    if (packInProgressPrevious === undefined) {
      delete process.env[PACK_IN_PROGRESS_ENV];
    } else {
      process.env[PACK_IN_PROGRESS_ENV] = packInProgressPrevious;
    }
    packInProgressPrevious = undefined;
  });

  it("parses --candidate absolute path", () => {
    expect(parseCandidateArg(["--candidate=/tmp/foo.tgz"])).toBe(
      path.resolve("/tmp/foo.tgz"),
    );
  });

  it("rejects a nonexistent candidate tarball", () => {
    expect(() =>
      loadScanPrepCandidateFromTarball("/tmp/does-not-exist-scan-prep.tgz"),
    ).toThrow(/candidate tarball not found/);
  });

  it("rejects symbolic-link candidates", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-symlink-"),
    );
    const realTarball = path.join(outputDir, "real.tgz");
    const linkTarball = path.join(outputDir, "link.tgz");
    createTarballWithManifest(realTarball, {
      name: PACKAGE_NAME,
      version: readSourceManifest().version,
    });
    symlinkSync(realTarball, linkTarball);
    try {
      expect(() => loadScanPrepCandidateFromTarball(linkTarball)).toThrow(
        /must not be a symbolic link/,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("rejects wrong package identity in candidate manifest", () => {
    const tarball = path.join(tmpdir(), `wrong-name-${Date.now()}.tgz`);
    createTarballWithManifest(tarball, {
      name: "@wrong/package",
      version: "0.1.0",
    });
    try {
      expect(() => loadScanPrepCandidateFromTarball(tarball)).toThrow(
        /package name mismatch/,
      );
    } finally {
      rmSync(tarball, { force: true });
    }
  });

  it("rejects wrong candidate version", () => {
    const tarball = path.join(tmpdir(), `wrong-version-${Date.now()}.tgz`);
    createTarballWithManifest(tarball, {
      name: PACKAGE_NAME,
      version: "9.9.9",
    });
    try {
      expect(() => loadScanPrepCandidateFromTarball(tarball)).toThrow(
        /version mismatch/,
      );
    } finally {
      rmSync(tarball, { force: true });
    }
  });

  it("reports packed version mismatch during artifact validation", () => {
    const loaded = loadScanPrepCandidateFromTarball(packedCandidatePath);
    const violations = validatePackedScanPrepArtifact({
      tarballPath: loaded.tarballPath,
      tarballName: loaded.tarballName,
      version: "9.9.9",
      files: loaded.files,
      manifest: loaded.manifest,
      sourceManifestBefore: readSourcePackageJsonRaw(),
    });
    expect(violations).toContain("packed version mismatch");
  });

  it("requires fixture mode for minimal synthetic tarballs", () => {
    const violations = validatePackedScanPrepArtifact({
      tarballPath: "/tmp/example.tgz",
      tarballName: "example.tgz",
      version: "0.1.0",
      files: ["package/package.json"],
      manifest: {
        name: PACKAGE_NAME,
        version: "0.1.0",
        publishConfig: {
          registry: "https://registry.npmjs.org/",
          access: "public",
        },
        dependencies: { "@mergesignal/shared": "workspace:^" },
      },
      sourceManifestBefore: readSourcePackageJsonRaw(),
      validationMode: "release",
    });
    expect(violations).toContain("missing package/dist/index.js");
    expect(violations).toContain("missing package/dist/index.d.ts");
  });

  it("supports explicitly requested fixture validation mode", () => {
    const violations = validatePackedScanPrepArtifact({
      tarballPath: "/tmp/example.tgz",
      tarballName: "example.tgz",
      version: "0.1.0",
      files: ["package/package.json"],
      manifest: {
        name: PACKAGE_NAME,
        version: "0.1.0",
        publishConfig: {
          registry: "https://registry.npmjs.org/",
          access: "public",
        },
        dependencies: { "@mergesignal/shared": "workspace:^" },
      },
      sourceManifestBefore: readSourcePackageJsonRaw(),
      validationMode: "fixture",
    });
    expect(violations.some((v) => v.includes("forbidden protocol"))).toBe(true);
    expect(violations.some((v) => v.includes("missing package/dist"))).toBe(
      false,
    );
  });

  it("fails release mode when a required runtime entrypoint is missing", () => {
    const loaded = loadScanPrepCandidateFromTarball(packedCandidatePath);
    const filesWithoutRuntime = loaded.files.filter(
      (file) => !file.endsWith("package/dist/index.js"),
    );
    const violations = validatePackedScanPrepArtifact({
      tarballPath: loaded.tarballPath,
      tarballName: loaded.tarballName,
      version: loaded.version,
      files: filesWithoutRuntime,
      manifest: loaded.manifest,
      sourceManifestBefore: readSourcePackageJsonRaw(),
      validationMode: "release",
    });
    expect(violations).toContain("missing package/dist/index.js");
  });

  it("fails release mode when a required declaration entrypoint is missing", () => {
    const loaded = loadScanPrepCandidateFromTarball(packedCandidatePath);
    const filesWithoutDeclarations = loaded.files.filter(
      (file) => !file.endsWith("package/dist/lockfile.d.ts"),
    );
    const violations = validatePackedScanPrepArtifact({
      tarballPath: loaded.tarballPath,
      tarballName: loaded.tarballName,
      version: loaded.version,
      files: filesWithoutDeclarations,
      manifest: loaded.manifest,
      sourceManifestBefore: readSourcePackageJsonRaw(),
      validationMode: "release",
    });
    expect(violations).toContain("missing package/dist/lockfile.d.ts");
  });

  it("blocks supplied candidate before isolated install when artifact hygiene fails", () => {
    const tarball = path.join(tmpdir(), `bad-hygiene-${Date.now()}.tgz`);
    createTarballWithManifest(tarball, {
      name: PACKAGE_NAME,
      version: readSourceManifest().version,
      publishConfig: {
        registry: "https://registry.npmjs.org/",
        access: "public",
      },
      dependencies: { "@mergesignal/shared": "workspace:^" },
    });
    try {
      const candidate = loadScanPrepCandidateFromTarball(tarball);
      expect(() =>
        assertPackedScanPrepArtifactValid(
          candidate,
          readSourcePackageJsonRaw(),
        ),
      ).toThrow(/packed artifact validation failed/);
    } finally {
      rmSync(tarball, { force: true });
    }
  });

  it("fails closed when candidate digest changes", () => {
    expect(() =>
      assertCandidateDigestUnchanged({
        candidatePath: packedCandidatePath,
        digestBefore: "before",
        digestAfter: "after",
      }),
    ).toThrow(/digest mismatch/);
  });

  it("does not report ready when isolated install fails", () => {
    const outputDir = path.dirname(packedCandidatePath);
    const packed = loadScanPrepCandidateFromTarball(packedCandidatePath);
    const reportPath = releaseCandidateReportPath(
      outputDir,
      packed.tarballName,
    );
    const spy = vi
      .spyOn(isolatedInstall, "runScanPrepIsolatedInstall")
      .mockImplementation(() => {
        throw new Error("isolated install failed");
      });

    try {
      assertPackedScanPrepArtifactValid(packed, readSourcePackageJsonRaw());
      expect(() => {
        isolatedInstall.runScanPrepIsolatedInstall({ candidate: packed });
        writeReleaseCandidateReport(reportPath, packed, {
          artifactValidation: "pass",
          isolatedInstall: "pass",
        });
      }).toThrow(/isolated install failed/);
      expect(existsSync(reportPath)).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it("publishes the release report atomically with resolved candidate evidence", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-atomic-report-"),
    );
    const packed = loadScanPrepCandidateFromTarball(packedCandidatePath);
    const localCandidatePath = path.join(outputDir, packed.tarballName);
    execSync(`cp "${packed.tarballPath}" "${localCandidatePath}"`, {
      stdio: "ignore",
    });
    const localPacked = loadScanPrepCandidateFromTarball(localCandidatePath);
    const reportPath = releaseCandidateReportPath(
      outputDir,
      localPacked.tarballName,
    );

    try {
      writeReleaseCandidateReport(reportPath, localPacked, {
        artifactValidation: "pass",
        isolatedInstall: "pass",
      });

      expect(existsSync(reportPath)).toBe(true);
      expect(
        readdirSync(outputDir).some((entry) => entry.includes(".tmp-")),
      ).toBe(false);

      const report = readReleaseCandidateReport(reportPath);
      expect(() => JSON.parse(readFileSync(reportPath, "utf8"))).not.toThrow();
      expect(report.package).toBe(PACKAGE_NAME);
      expect(report.version).toBe(localPacked.version);
      expect(report.candidatePath).toBe(realpathSync(localPacked.tarballPath));
      expect(report.digestSha512).toBe(localPacked.digestSha512);
      expect(report.integrity).toBe(`sha512-${localPacked.digestSha512}`);
      expect(report.artifactValidation).toBe("pass");
      expect(report.isolatedInstall).toBe("pass");
      expect(resolveCanonicalReportPath(reportPath)).toBe(
        realpathSync(reportPath),
      );
      expect(path.dirname(resolveCanonicalReportPath(reportPath))).toBe(
        path.dirname(realpathSync(localPacked.tarballPath)),
      );
      assertReleaseCandidateEvidenceCoherent({
        candidate: localPacked,
        reportPath,
      });
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("cleans temporary report files when atomic rename fails", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-atomic-fail-"),
    );
    const packed = loadScanPrepCandidateFromTarball(packedCandidatePath);
    const reportPath = releaseCandidateReportPath(
      outputDir,
      packed.tarballName,
    );

    try {
      expect(() =>
        writeReleaseCandidateReport(
          reportPath,
          packed,
          {
            artifactValidation: "pass",
            isolatedInstall: "pass",
          },
          {
            renameReport: () => {
              throw new Error("rename failed");
            },
          },
        ),
      ).toThrow(/rename failed/);
      expect(existsSync(reportPath)).toBe(false);
      expect(
        readdirSync(outputDir).some((entry) => entry.includes(".tmp-")),
      ).toBe(false);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("cleans temporary report files when report write fails", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-write-fail-"),
    );
    const packed = loadScanPrepCandidateFromTarball(packedCandidatePath);
    const reportPath = releaseCandidateReportPath(
      outputDir,
      packed.tarballName,
    );
    const unrelatedPath = path.join(outputDir, "notes.txt");
    const candidateDigestBefore = digestSha512OfFile(packed.tarballPath);

    try {
      writeFileSync(unrelatedPath, "keep me");

      expect(() =>
        writeReleaseCandidateReport(
          reportPath,
          packed,
          {
            artifactValidation: "pass",
            isolatedInstall: "pass",
          },
          {
            writeReport: () => {
              throw new Error("write failed");
            },
          },
        ),
      ).toThrow(/write failed/);
      expect(existsSync(reportPath)).toBe(false);
      expect(
        readdirSync(outputDir).some((entry) => entry.includes(".tmp-")),
      ).toBe(false);
      expect(readFileSync(unrelatedPath, "utf8")).toBe("keep me");
      expect(digestSha512OfFile(packed.tarballPath)).toBe(
        candidateDigestBefore,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("allows an empty release output directory", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-output-empty-"),
    );
    try {
      expect(() =>
        assertReleaseOutputDirectoryReady(
          outputDir,
          readSourceManifest().version,
        ),
      ).not.toThrow();
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("rejects an existing target candidate in the release output directory", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-output-stale-tarball-"),
    );
    const version = readSourceManifest().version;
    const tarballName = releaseCandidateTarballName(version);
    try {
      writeFileSync(path.join(outputDir, tarballName), "stale");
      expect(() =>
        assertReleaseOutputDirectoryReady(outputDir, version),
      ).toThrow(
        /already contains a prior Scan Preparation candidate or report/,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("rejects an existing target report in the release output directory", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-output-stale-report-"),
    );
    const version = readSourceManifest().version;
    const reportPath = releaseCandidateReportPath(
      outputDir,
      releaseCandidateTarballName(version),
    );
    try {
      writeFileSync(reportPath, "{}");
      expect(() =>
        assertReleaseOutputDirectoryReady(outputDir, version),
      ).toThrow(
        /already contains a prior Scan Preparation candidate or report/,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("does not reject unrelated files in the release output directory", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-output-unrelated-"),
    );
    try {
      writeFileSync(path.join(outputDir, "notes.txt"), "keep me");
      expect(() =>
        assertReleaseOutputDirectoryReady(
          outputDir,
          readSourceManifest().version,
        ),
      ).not.toThrow();
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("does not leave stale candidate evidence after a failed rerun policy check", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-stale-evidence-"),
    );
    const version = readSourceManifest().version;
    const tarballName = releaseCandidateTarballName(version);
    const candidatePath = path.join(outputDir, tarballName);
    try {
      writeFileSync(candidatePath, "stale");
      expect(() =>
        assertReleaseOutputDirectoryReady(outputDir, version),
      ).toThrow(/Use a fresh external output directory/);
      expect(existsSync(candidatePath)).toBe(true);
      expect(
        existsSync(releaseCandidateReportPath(outputDir, tarballName)),
      ).toBe(false);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  describe("release candidate evidence coherence", () => {
    function withEvidenceFixture(
      run: (input: {
        outputDir: string;
        packed: ReturnType<typeof loadScanPrepCandidateFromTarball>;
        reportPath: string;
      }) => void,
    ): void {
      const outputDir = mkdtempSync(
        path.join(tmpdir(), "ms-scan-prep-candidate-evidence-"),
      );
      const packed = loadScanPrepCandidateFromTarball(packedCandidatePath);
      const reportPath = releaseCandidateReportPath(
        outputDir,
        packed.tarballName,
      );
      try {
        run({ outputDir, packed, reportPath });
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    }

    it("accepts a complete coherent candidate and report pair", () => {
      withEvidenceFixture(({ packed, reportPath }) => {
        writeValidReleaseReport(reportPath, packed);
        expect(() =>
          assertReleaseCandidateEvidenceCoherent({
            candidate: packed,
            reportPath,
          }),
        ).not.toThrow();
      });
    });

    it("rejects a candidate path mismatch", () => {
      withEvidenceFixture(({ packed, reportPath }) => {
        writeTamperedReleaseReport(reportPath, packed, (report) => {
          report.candidatePath = "/tmp/wrong-candidate.tgz";
        });
        expect(() =>
          assertReleaseCandidateEvidenceCoherent({
            candidate: packed,
            reportPath,
          }),
        ).toThrow(/path mismatch/);
      });
    });

    it("rejects a candidate digest mismatch", () => {
      withEvidenceFixture(({ packed, reportPath }) => {
        writeTamperedReleaseReport(reportPath, packed, (report) => {
          report.digestSha512 = "wrong-digest";
          report.integrity = "sha512-wrong-digest";
        });
        expect(() =>
          assertReleaseCandidateEvidenceCoherent({
            candidate: packed,
            reportPath,
          }),
        ).toThrow(/digest mismatch/);
      });
    });

    it("rejects a package name mismatch", () => {
      withEvidenceFixture(({ packed, reportPath }) => {
        writeTamperedReleaseReport(reportPath, packed, (report) => {
          report.package = "@wrong/package";
        });
        expect(() =>
          assertReleaseCandidateEvidenceCoherent({
            candidate: packed,
            reportPath,
          }),
        ).toThrow(/package mismatch/);
      });
    });

    it("rejects an integrity mismatch without digest mismatch", () => {
      withEvidenceFixture(({ packed, reportPath }) => {
        writeTamperedReleaseReport(reportPath, packed, (report) => {
          report.integrity = "sha512-wrong-integrity-only";
        });
        expect(() =>
          assertReleaseCandidateEvidenceCoherent({
            candidate: packed,
            reportPath,
          }),
        ).toThrow(/integrity mismatch/);
      });
    });

    it("rejects a packed manifest mismatch", () => {
      withEvidenceFixture(({ packed, reportPath }) => {
        writeTamperedReleaseReport(reportPath, packed, (report) => {
          report.manifest = {
            ...report.manifest,
            version: "9.9.9",
          };
        });
        expect(() =>
          assertReleaseCandidateEvidenceCoherent({
            candidate: packed,
            reportPath,
          }),
        ).toThrow(/manifest mismatch/);
      });
    });

    it("rejects a packed file count mismatch", () => {
      withEvidenceFixture(({ packed, reportPath }) => {
        writeTamperedReleaseReport(reportPath, packed, (report) => {
          report.fileCount = report.fileCount + 1;
        });
        expect(() =>
          assertReleaseCandidateEvidenceCoherent({
            candidate: packed,
            reportPath,
          }),
        ).toThrow(/file count mismatch/);
      });
    });

    it("rejects a non-pass artifact validation status", () => {
      withEvidenceFixture(({ packed, reportPath }) => {
        writeTamperedReleaseReport(reportPath, packed, (report) => {
          report.artifactValidation = "fail" as "pass";
        });
        expect(() =>
          assertReleaseCandidateEvidenceCoherent({
            candidate: packed,
            reportPath,
          }),
        ).toThrow(/artifactValidation is not pass/);
      });
    });

    it("rejects a non-pass isolated install status", () => {
      withEvidenceFixture(({ packed, reportPath }) => {
        writeTamperedReleaseReport(reportPath, packed, (report) => {
          report.isolatedInstall = "fail" as "pass";
        });
        expect(() =>
          assertReleaseCandidateEvidenceCoherent({
            candidate: packed,
            reportPath,
          }),
        ).toThrow(/isolatedInstall is not pass/);
      });
    });

    it("removes the report when post-write evidence coherence fails", () => {
      const outputDir = mkdtempSync(
        path.join(tmpdir(), "ms-scan-prep-candidate-coherence-fail-"),
      );
      const packed = loadScanPrepCandidateFromTarball(packedCandidatePath);
      const localCandidatePath = path.join(outputDir, packed.tarballName);
      const unrelatedPath = path.join(outputDir, "notes.txt");

      try {
        execSync(`cp "${packed.tarballPath}" "${localCandidatePath}"`, {
          stdio: "ignore",
        });
        const localPacked =
          loadScanPrepCandidateFromTarball(localCandidatePath);
        const reportPath = releaseCandidateReportPath(
          outputDir,
          localPacked.tarballName,
        );
        const digestBefore = digestSha512OfFile(localPacked.tarballPath);
        writeFileSync(unrelatedPath, "keep me");

        expect(() =>
          writeAndAssertReleaseCandidateEvidenceCoherent({
            reportPath,
            candidate: localPacked,
            validation: {
              artifactValidation: "pass",
              isolatedInstall: "pass",
            },
            assertEvidenceCoherent: () => {
              throw new Error("coherence failed");
            },
          }),
        ).toThrow(/coherence failed/);

        expect(existsSync(reportPath)).toBe(false);
        expect(
          readdirSync(outputDir).some((entry) => entry.includes(".tmp-")),
        ).toBe(false);
        expect(existsSync(localPacked.tarballPath)).toBe(true);
        expect(digestSha512OfFile(localPacked.tarballPath)).toBe(digestBefore);
        expect(readFileSync(unrelatedPath, "utf8")).toBe("keep me");
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });

  it("fails when the recursion guard environment is already set", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-pack-guard-"),
    );
    packInProgressPrevious = process.env[PACK_IN_PROGRESS_ENV];
    process.env[PACK_IN_PROGRESS_ENV] = "1";
    try {
      expect(() => packScanPrepToDirectory(outputDir)).toThrow(
        /already set; refusing to skip tests/,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("allows unit fixtures to pack without build or tests", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-pack-fixture-"),
    );
    packInProgressPrevious = process.env[PACK_IN_PROGRESS_ENV];
    process.env[PACK_IN_PROGRESS_ENV] = "1";
    try {
      const packed = packScanPrepToDirectory(outputDir, {
        runBuildAndTest: false,
      });
      expect(existsSync(packed.tarballPath)).toBe(true);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("loads an existing candidate without repacking", () => {
    const digestBefore = digestSha512OfFile(packedCandidatePath);
    const loaded = loadScanPrepCandidateFromTarball(packedCandidatePath);
    expect(loaded.tarballPath).toBe(realpathSync(packedCandidatePath));
    expect(loaded.digestSha512).toBe(digestBefore);
    expect(loaded.manifest.name).toBe(PACKAGE_NAME);
  });

  it("keeps candidate digest unchanged through artifact validation", () => {
    const digestBefore = digestSha512OfFile(packedCandidatePath);
    const loaded = loadScanPrepCandidateFromTarball(packedCandidatePath);
    assertPackedScanPrepArtifactValid(loaded, readSourcePackageJsonRaw());
    expect(digestSha512OfFile(packedCandidatePath)).toBe(digestBefore);
    expect(loaded.digestSha512).toBe(digestBefore);
  });

  it("does not recurse through pack and test during unit fixtures", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-no-recursion-"),
    );
    try {
      expect(process.env[PACK_IN_PROGRESS_ENV]).toBeUndefined();
      packScanPrepToDirectory(outputDir, { runBuildAndTest: false });
      expect(process.env[PACK_IN_PROGRESS_ENV]).toBeUndefined();
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("writes generated candidates outside the repository working tree", () => {
    const outputDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-candidate-outside-"),
    );
    const repoRoot = path.resolve(SCAN_PREP_DIR, "../..");
    try {
      const packed = packScanPrepToDirectory(outputDir, {
        runBuildAndTest: false,
      });
      expect(path.dirname(packed.tarballPath)).toBe(realpathSync(outputDir));
      expect(packed.tarballPath.startsWith(realpathSync(repoRoot))).toBe(false);
      expect(existsSync(path.join(SCAN_PREP_DIR, packed.tarballName))).toBe(
        false,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
