#!/usr/bin/env tsx
/**
 * Produce and validate the canonical @mergesignal/scan-prep release candidate tarball.
 * Does not publish. Intended for manual first publication (interactive npm login + 2FA).
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  PACKAGE_NAME,
  assertCandidateDigestUnchanged,
  assertPackedScanPrepArtifactValid,
  assertReleaseOutputDirectoryReady,
  digestSha512OfFile,
  packScanPrepToDirectory,
  readSourceManifest,
  readSourcePackageJsonRaw,
  resolveCanonicalReportPath,
  writeAndAssertReleaseCandidateEvidenceCoherent,
} from "./lib/scan-prep-pack-artifact.ts";
import { runScanPrepIsolatedInstall } from "./lib/scan-prep-isolated-install.ts";

function parseOutputDir(argv: string[]): string {
  const flag = argv.find((arg) => arg.startsWith("--output-dir="));
  if (flag) {
    return path.resolve(flag.split("=")[1] ?? "");
  }
  return mkdtempSync(path.join(tmpdir(), "ms-scan-prep-release-candidate-"));
}

function main(): void {
  const outputDir = parseOutputDir(process.argv.slice(2));
  const version = readSourceManifest().version;
  const { reportPath } = assertReleaseOutputDirectoryReady(outputDir, version);

  const sourceBefore = readSourcePackageJsonRaw();
  const packed = packScanPrepToDirectory(outputDir);
  const digestBefore = digestSha512OfFile(packed.tarballPath);

  assertPackedScanPrepArtifactValid(packed, sourceBefore);

  runScanPrepIsolatedInstall({ candidate: packed });

  const digestAfter = digestSha512OfFile(packed.tarballPath);
  assertCandidateDigestUnchanged({
    candidatePath: packed.tarballPath,
    digestBefore,
    digestAfter,
  });

  const validatedCandidate = {
    ...packed,
    digestSha512: digestAfter,
  };
  writeAndAssertReleaseCandidateEvidenceCoherent({
    reportPath,
    candidate: validatedCandidate,
    validation: {
      artifactValidation: "pass",
      isolatedInstall: "pass",
    },
  });
  const canonicalReportPath = resolveCanonicalReportPath(reportPath);

  process.stdout.write("pack:scan-prep-release-candidate OK\n");
  process.stdout.write(`  package: ${PACKAGE_NAME}@${packed.version}\n`);
  process.stdout.write(`  candidate: ${packed.tarballPath}\n`);
  process.stdout.write(`  report: ${canonicalReportPath}\n`);
  process.stdout.write(`  integrity: sha512-${digestAfter}\n`);
  process.stdout.write(`  artifactValidation: pass\n`);
  process.stdout.write(`  isolatedInstall: pass\n`);
  process.stdout.write(
    `  manifest: ${JSON.stringify(packed.manifest.dependencies ?? {})}\n`,
  );
  process.stdout.write(
    `  manual publish: npm publish "${packed.tarballPath}" --access public\n`,
  );
}

main();
