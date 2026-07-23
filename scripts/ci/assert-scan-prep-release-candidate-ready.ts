#!/usr/bin/env tsx
/**
 * Structured release-candidate evidence binding for Scan Preparation publication.
 */
import path from "node:path";

import {
  assertReleaseCandidateReadyForPublication,
  expectedReleaseCandidatePublicationEvidencePath,
  expectedReleaseCandidateReportPath,
  writeReleaseCandidatePublicationEvidence,
} from "./lib/scan-prep-pack-artifact.ts";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function parseVersion(argv: string[]): string {
  const flag = argv.find((arg) => arg.startsWith("--version="));
  const version = flag?.split("=")[1]?.trim();
  if (!version) {
    throw new Error("Version required: --version=X.Y.Z");
  }
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`Invalid version: ${version}`);
  }
  return version;
}

function parseReportPath(argv: string[]): string | undefined {
  const flag = argv.find((arg) => arg.startsWith("--report="));
  const value = flag?.split("=")[1]?.trim();
  return value ? value : undefined;
}

function parseOutputDir(argv: string[]): string | undefined {
  const flag = argv.find((arg) => arg.startsWith("--output-dir="));
  const value = flag?.split("=")[1]?.trim();
  return value ? path.resolve(value) : undefined;
}

function parseJsonOutputPath(argv: string[]): string | undefined {
  const flag = argv.find((arg) => arg.startsWith("--json-output="));
  const value = flag?.split("=")[1]?.trim();
  return value ? path.resolve(value) : undefined;
}

function main(): void {
  const argv = process.argv.slice(2);
  const version = parseVersion(argv);
  const outputDir = parseOutputDir(argv);
  const reportPath =
    parseReportPath(argv) ??
    (() => {
      if (!outputDir) {
        throw new Error(
          "Report path required: --report=PATH or --output-dir=DIR with --version",
        );
      }
      return expectedReleaseCandidateReportPath(outputDir, version);
    })();

  const evidence = assertReleaseCandidateReadyForPublication({
    reportPath,
    expectedVersion: version,
  });

  const jsonOutputPath =
    parseJsonOutputPath(argv) ??
    (outputDir
      ? expectedReleaseCandidatePublicationEvidencePath(outputDir, version)
      : undefined);

  if (jsonOutputPath) {
    writeReleaseCandidatePublicationEvidence({
      evidencePath: jsonOutputPath,
      evidence,
      outputDir,
    });
    process.stdout.write("assert:scan-prep-release-candidate-ready OK\n");
    process.stdout.write(`  evidence: ${jsonOutputPath}\n`);
    process.stdout.write(`  candidate: ${evidence.candidatePath}\n`);
    process.stdout.write(`  report: ${evidence.reportPath}\n`);
    process.stdout.write(`  integrity: ${evidence.integrity}\n`);
    return;
  }

  process.stdout.write("assert:scan-prep-release-candidate-ready OK\n");
  process.stdout.write(`  candidate: ${evidence.candidatePath}\n`);
  process.stdout.write(`  report: ${evidence.reportPath}\n`);
  process.stdout.write(`  integrity: ${evidence.integrity}\n`);
}

main();
