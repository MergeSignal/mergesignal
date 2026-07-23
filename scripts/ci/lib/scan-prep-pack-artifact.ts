/**
 * Shared pack + validation for @mergesignal/scan-prep release candidates.
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  APPROVED_LOCKFILE_RUNTIME,
  APPROVED_ROOT_RUNTIME,
} from "../../../packages/scan-prep/approved-export-surface.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SCAN_PREP_DIR = path.resolve(
  __dirname,
  "../../../packages/scan-prep",
);
export const EXPECTED_SHARED_VERSION = "0.13.0";
export const PACKAGE_NAME = "@mergesignal/scan-prep";
export const NPMJS_REGISTRY = "https://registry.npmjs.org/";
const PRIVATE_PACKAGE = "@mergesignal/contracts";
const INVALID_PROTOCOL = /^(catalog:|workspace:|link:|file:)/;
export const PACK_IN_PROGRESS_ENV = "MS_SCAN_PREP_PACK_IN_PROGRESS";

const REQUIRED_RELEASE_ENTRYPOINTS = [
  "package/dist/index.js",
  "package/dist/index.d.ts",
  "package/dist/lockfile.js",
  "package/dist/lockfile.d.ts",
] as const;

export type PackedScanPrepManifest = {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  publishConfig?: { registry?: string; access?: string };
};

export type ScanPrepArtifactValidationMode = "release" | "fixture";

export type ScanPrepPackResult = {
  tarballPath: string;
  tarballName: string;
  version: string;
  files: string[];
  manifest: PackedScanPrepManifest;
  digestSha512: string;
};

function run(command: string, cwd: string): string {
  return execSync(command, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function collectDeclarationFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectDeclarationFiles(full));
    } else if (entry.name.endsWith(".d.ts")) {
      files.push(full);
    }
  }
  return files;
}

export function readSourcePackageJsonRaw(): string {
  return readFileSync(path.join(SCAN_PREP_DIR, "package.json"), "utf8");
}

export function readSourceManifest(): PackedScanPrepManifest {
  return JSON.parse(readSourcePackageJsonRaw()) as PackedScanPrepManifest;
}

export function resolveReleaseCandidatePath(candidatePath: string): string {
  const absPath = path.resolve(candidatePath);
  if (!existsSync(absPath)) {
    throw new Error(`candidate tarball not found: ${absPath}`);
  }

  const stat = lstatSync(absPath);
  if (stat.isSymbolicLink()) {
    throw new Error(
      `candidate tarball must not be a symbolic link: ${absPath}`,
    );
  }
  if (!stat.isFile()) {
    throw new Error(`candidate tarball must be a regular file: ${absPath}`);
  }

  return realpathSync(absPath);
}

export function digestSha512OfFile(filePath: string): string {
  const resolvedPath = resolveReleaseCandidatePath(filePath);
  return createHash("sha512")
    .update(readFileSync(resolvedPath))
    .digest("base64");
}

export function parseCandidateArg(argv: string[]): string | undefined {
  const flag = argv.find((arg) => arg.startsWith("--candidate="));
  const value = flag?.split("=")[1]?.trim();
  return value ? path.resolve(value) : undefined;
}

export function releaseCandidateTarballName(version: string): string {
  return `mergesignal-scan-prep-${version}.tgz`;
}

export function releaseCandidateReportPath(
  outputDir: string,
  tarballName: string,
): string {
  return path.join(outputDir, `${tarballName}.report.json`);
}

export function releaseCandidatePathsForVersion(
  outputDir: string,
  version: string,
): {
  tarballName: string;
  candidatePath: string;
  reportPath: string;
} {
  const tarballName = releaseCandidateTarballName(version);
  return {
    tarballName,
    candidatePath: path.join(outputDir, tarballName),
    reportPath: releaseCandidateReportPath(outputDir, tarballName),
  };
}

export function assertReleaseOutputDirectoryReady(
  outputDir: string,
  version: string,
): {
  tarballName: string;
  candidatePath: string;
  reportPath: string;
} {
  const paths = releaseCandidatePathsForVersion(outputDir, version);
  const stalePaths: string[] = [];

  if (existsSync(paths.candidatePath)) {
    stalePaths.push(paths.candidatePath);
  }
  if (existsSync(paths.reportPath)) {
    stalePaths.push(paths.reportPath);
  }

  if (stalePaths.length > 0) {
    throw new Error(
      `release output directory already contains a prior Scan Preparation candidate or report for ${version}:\n${stalePaths.map((stalePath) => `  - ${stalePath}`).join("\n")}\nUse a fresh external output directory, or explicitly remove the stale candidate and report before retrying.`,
    );
  }

  return paths;
}

export type ReleaseCandidateReport = {
  package: string;
  version: string;
  candidatePath: string;
  digestSha512: string;
  integrity: string;
  manifest: PackedScanPrepManifest;
  fileCount: number;
  artifactValidation: "pass";
  isolatedInstall: "pass";
};

export function readReleaseCandidateReport(
  reportPath: string,
): ReleaseCandidateReport {
  return JSON.parse(readFileSync(reportPath, "utf8")) as ReleaseCandidateReport;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function stableJsonForComparison(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

export function resolveCanonicalReportPath(reportPath: string): string {
  const absPath = path.resolve(reportPath);
  if (!existsSync(absPath)) {
    throw new Error(`release candidate report not found: ${absPath}`);
  }

  const stat = lstatSync(absPath);
  if (stat.isSymbolicLink()) {
    throw new Error(
      `release candidate report must not be a symbolic link: ${absPath}`,
    );
  }
  if (!stat.isFile()) {
    throw new Error(
      `release candidate report must be a regular file: ${absPath}`,
    );
  }

  return realpathSync(absPath);
}

export function assertReleaseCandidateEvidenceCoherent(input: {
  candidate: ScanPrepPackResult;
  reportPath: string;
}): void {
  if (!existsSync(input.reportPath)) {
    throw new Error(`release candidate report not found: ${input.reportPath}`);
  }

  const report = readReleaseCandidateReport(input.reportPath);
  const resolvedCandidatePath = resolveReleaseCandidatePath(
    input.candidate.tarballPath,
  );
  const digestSha512 = digestSha512OfFile(resolvedCandidatePath);

  if (report.package !== PACKAGE_NAME) {
    throw new Error("release candidate report package mismatch");
  }
  if (report.version !== input.candidate.version) {
    throw new Error("release candidate report version mismatch");
  }
  if (report.candidatePath !== resolvedCandidatePath) {
    throw new Error("release candidate report path mismatch");
  }
  if (report.digestSha512 !== digestSha512) {
    throw new Error("release candidate report digest mismatch");
  }
  if (report.integrity !== `sha512-${digestSha512}`) {
    throw new Error("release candidate report integrity mismatch");
  }
  if (
    stableJsonForComparison(report.manifest) !==
    stableJsonForComparison(input.candidate.manifest)
  ) {
    throw new Error("release candidate report manifest mismatch");
  }
  if (report.fileCount !== input.candidate.files.length) {
    throw new Error("release candidate report file count mismatch");
  }
  if (report.artifactValidation !== "pass") {
    throw new Error("release candidate report artifactValidation is not pass");
  }
  if (report.isolatedInstall !== "pass") {
    throw new Error("release candidate report isolatedInstall is not pass");
  }
}

export function removeReleaseCandidateReport(reportPath: string): void {
  if (existsSync(reportPath)) {
    rmSync(reportPath);
  }
}

export function writeAndAssertReleaseCandidateEvidenceCoherent(input: {
  reportPath: string;
  candidate: ScanPrepPackResult;
  validation: {
    artifactValidation: "pass";
    isolatedInstall: "pass";
  };
  writeOptions?: {
    writeReport?: (tempPath: string, payload: string) => void;
    renameReport?: (tempPath: string, finalPath: string) => void;
  };
  assertEvidenceCoherent?: (value: {
    candidate: ScanPrepPackResult;
    reportPath: string;
  }) => void;
}): void {
  writeReleaseCandidateReport(
    input.reportPath,
    input.candidate,
    input.validation,
    input.writeOptions,
  );

  const assertEvidenceCoherent =
    input.assertEvidenceCoherent ?? assertReleaseCandidateEvidenceCoherent;

  try {
    assertEvidenceCoherent({
      candidate: input.candidate,
      reportPath: input.reportPath,
    });
  } catch (error) {
    try {
      removeReleaseCandidateReport(input.reportPath);
    } catch {
      // Preserve the original coherence failure if report cleanup fails.
    }
    throw error;
  }
}

export function loadScanPrepCandidateFromTarball(
  tarballPath: string,
): ScanPrepPackResult {
  const resolvedPath = resolveReleaseCandidatePath(tarballPath);
  const tarballName = path.basename(resolvedPath);
  const packDir = path.dirname(resolvedPath);
  const files = run(`tar -tzf "${tarballName}"`, packDir)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const manifest = JSON.parse(
    run(`tar -xOf "${tarballName}" package/package.json`, packDir),
  ) as PackedScanPrepManifest;

  if (manifest.name !== PACKAGE_NAME) {
    throw new Error(
      `candidate package name mismatch (expected ${PACKAGE_NAME}, got ${manifest.name})`,
    );
  }

  const expectedVersion = readSourceManifest().version;
  if (manifest.version !== expectedVersion) {
    throw new Error(
      `candidate version mismatch (expected ${expectedVersion}, got ${manifest.version})`,
    );
  }

  const digestSha512 = digestSha512OfFile(resolvedPath);

  return {
    tarballPath: resolvedPath,
    tarballName,
    version: manifest.version,
    files,
    manifest,
    digestSha512,
  };
}

export function packScanPrepToDirectory(
  packDestination: string,
  options?: { runBuildAndTest?: boolean },
): ScanPrepPackResult {
  const runBuildAndTest = options?.runBuildAndTest !== false;

  if (runBuildAndTest) {
    if (process.env[PACK_IN_PROGRESS_ENV] === "1") {
      throw new Error(
        `${PACK_IN_PROGRESS_ENV}=1 is already set; refusing to skip tests during a top-level pack`,
      );
    }

    run("pnpm run build", SCAN_PREP_DIR);
    const previous = process.env[PACK_IN_PROGRESS_ENV];
    process.env[PACK_IN_PROGRESS_ENV] = "1";
    try {
      run("pnpm run test", SCAN_PREP_DIR);
    } finally {
      if (previous === undefined) {
        delete process.env[PACK_IN_PROGRESS_ENV];
      } else {
        process.env[PACK_IN_PROGRESS_ENV] = previous;
      }
    }
  }

  const version = readSourceManifest().version;
  const tarballName = releaseCandidateTarballName(version);
  const tarballPath = path.join(packDestination, tarballName);
  if (existsSync(tarballPath)) rmSync(tarballPath);

  run(`pnpm pack --pack-destination "${packDestination}"`, SCAN_PREP_DIR);

  if (!existsSync(tarballPath)) {
    throw new Error(`Expected pack tarball at ${tarballPath}`);
  }

  const resolvedTarballPath = resolveReleaseCandidatePath(tarballPath);
  const packDir = path.dirname(resolvedTarballPath);

  const files = run(`tar -tzf "${tarballName}"`, packDir)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const manifest = JSON.parse(
    run(`tar -xOf "${tarballName}" package/package.json`, packDir),
  ) as PackedScanPrepManifest;

  const digestSha512 = digestSha512OfFile(resolvedTarballPath);

  return {
    tarballPath: resolvedTarballPath,
    tarballName,
    version,
    files,
    manifest,
    digestSha512,
  };
}

function appendMissingEntrypointViolations(
  files: string[],
  violations: string[],
): boolean {
  let allPresent = true;
  for (const entrypoint of REQUIRED_RELEASE_ENTRYPOINTS) {
    if (!files.some((file) => file.endsWith(entrypoint))) {
      violations.push(`missing ${entrypoint}`);
      allPresent = false;
    }
  }
  return allPresent;
}

export function validatePackedScanPrepArtifact(input: {
  tarballPath: string;
  tarballName: string;
  version: string;
  files: string[];
  manifest: PackedScanPrepManifest;
  sourceManifestBefore: string;
  validationMode?: ScanPrepArtifactValidationMode;
}): string[] {
  const {
    tarballPath,
    tarballName,
    version,
    files,
    manifest: packedManifest,
    sourceManifestBefore,
  } = input;
  const validationMode = input.validationMode ?? "release";
  const packDir = path.dirname(tarballPath);
  const violations: string[] = [];

  if (packedManifest.name !== PACKAGE_NAME)
    violations.push("packed name mismatch");
  if (packedManifest.version !== version)
    violations.push("packed version mismatch");
  if (packedManifest.private === true) {
    violations.push("packed manifest must not be private");
  }
  if (packedManifest.publishConfig?.registry !== NPMJS_REGISTRY) {
    violations.push(`packed publishConfig.registry must be ${NPMJS_REGISTRY}`);
  }
  if (packedManifest.publishConfig?.access !== "public") {
    violations.push("packed publishConfig.access must be public");
  }

  const sharedDep = packedManifest.dependencies?.["@mergesignal/shared"];
  if (sharedDep !== EXPECTED_SHARED_VERSION) {
    violations.push(
      `packed @mergesignal/shared must be exact ${EXPECTED_SHARED_VERSION} (got ${sharedDep ?? "missing"})`,
    );
  }
  if (packedManifest.dependencies?.[PRIVATE_PACKAGE]) {
    violations.push(`packed manifest must not depend on ${PRIVATE_PACKAGE}`);
  }
  for (const [name, spec] of Object.entries(
    packedManifest.dependencies ?? {},
  )) {
    if (INVALID_PROTOCOL.test(spec)) {
      violations.push(
        `packed dependency ${name} uses forbidden protocol: ${spec}`,
      );
    }
  }

  const serialized = JSON.stringify(packedManifest);
  if (/npm\.pkg\.github\.com/i.test(serialized)) {
    violations.push("packed manifest references GitHub Packages");
  }

  const forbiddenPaths = files.filter((f) =>
    /package\/(\.npmrc|\.env|src\/|vitest\.config|tsconfig\.json|approved-export-surface)/i.test(
      f,
    ),
  );
  if (forbiddenPaths.length > 0) {
    violations.push(
      `packed artifact includes forbidden paths: ${forbiddenPaths.join(", ")}`,
    );
  }

  const testArtifacts = files.filter((f) => /\.test\.(js|d\.ts)$/.test(f));
  if (testArtifacts.length > 0) {
    violations.push(`packed test artifacts: ${testArtifacts.join(", ")}`);
  }

  if (validationMode === "release") {
    const allEntrypointsPresent = appendMissingEntrypointViolations(
      files,
      violations,
    );
    if (allEntrypointsPresent) {
      const rootDecl = run(
        `tar -xOf "${tarballName}" package/dist/index.d.ts`,
        packDir,
      );
      const lockfileDecl = run(
        `tar -xOf "${tarballName}" package/dist/lockfile.d.ts`,
        packDir,
      );
      for (const symbol of APPROVED_ROOT_RUNTIME) {
        if (!rootDecl.includes(symbol))
          violations.push(`root declaration missing ${symbol}`);
      }
      for (const symbol of [
        "hasVerifiedLockfileIngress",
        "prepareLockfileContext",
      ]) {
        if (!lockfileDecl.includes(symbol)) {
          violations.push(`lockfile declaration missing ${symbol}`);
        }
      }
      for (const symbol of APPROVED_LOCKFILE_RUNTIME) {
        if (rootDecl.includes(symbol)) {
          violations.push(
            `lockfile runtime export ${symbol} leaked to root declaration`,
          );
        }
      }
    }

    const distDir = path.join(SCAN_PREP_DIR, "dist");
    for (const dts of collectDeclarationFiles(distDir)) {
      const rel = path.relative(distDir, dts).replace(/\\/g, "/");
      const content = readFileSync(dts, "utf8");
      if (content.includes(PRIVATE_PACKAGE)) {
        violations.push(
          `declaration file references ${PRIVATE_PACKAGE}: ${rel}`,
        );
      }
    }

    const sourceAfter = readFileSync(
      path.join(SCAN_PREP_DIR, "package.json"),
      "utf8",
    );
    if (sourceManifestBefore !== sourceAfter) {
      violations.push("packing must not modify source package.json");
    }
  }

  return violations;
}

export function assertCandidateDigestUnchanged(input: {
  candidatePath: string;
  digestBefore: string;
  digestAfter: string;
}): void {
  if (input.digestBefore !== input.digestAfter) {
    throw new Error(
      "candidate tarball bytes changed during validation (digest mismatch)",
    );
  }
  const currentDigest = digestSha512OfFile(input.candidatePath);
  if (currentDigest !== input.digestBefore) {
    throw new Error(
      "candidate tarball bytes changed during validation (digest mismatch)",
    );
  }
}

export function assertPackedScanPrepArtifactValid(
  packed: ScanPrepPackResult,
  sourceManifestBefore: string,
  options?: { validationMode?: ScanPrepArtifactValidationMode },
): void {
  const violations = validatePackedScanPrepArtifact({
    tarballPath: packed.tarballPath,
    tarballName: packed.tarballName,
    version: packed.version,
    files: packed.files,
    manifest: packed.manifest,
    sourceManifestBefore,
    validationMode: options?.validationMode ?? "release",
  });

  if (violations.length > 0) {
    throw new Error(
      `packed artifact validation failed:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
    );
  }
}

export function writeReleaseCandidateReport(
  reportPath: string,
  result: ScanPrepPackResult,
  validation: {
    artifactValidation: "pass";
    isolatedInstall: "pass";
  },
  options?: {
    writeReport?: (tempPath: string, payload: string) => void;
    renameReport?: (tempPath: string, finalPath: string) => void;
  },
): void {
  const payload = `${JSON.stringify(
    {
      package: PACKAGE_NAME,
      version: result.version,
      candidatePath: result.tarballPath,
      digestSha512: result.digestSha512,
      integrity: `sha512-${result.digestSha512}`,
      manifest: result.manifest,
      fileCount: result.files.length,
      artifactValidation: validation.artifactValidation,
      isolatedInstall: validation.isolatedInstall,
    },
    null,
    2,
  )}\n`;
  const tempReportPath = `${reportPath}.tmp-${process.pid}`;
  const writeReport =
    options?.writeReport ??
    ((tempPath: string, content: string) => {
      writeFileSync(tempPath, content);
    });
  const renameReport = options?.renameReport ?? renameSync;

  try {
    writeReport(tempReportPath, payload);
    renameReport(tempReportPath, reportPath);
  } catch (error) {
    if (existsSync(reportPath)) {
      rmSync(reportPath);
    }
    throw error;
  } finally {
    if (existsSync(tempReportPath)) {
      rmSync(tempReportPath);
    }
  }
}
