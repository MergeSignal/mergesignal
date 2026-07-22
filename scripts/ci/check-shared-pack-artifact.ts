#!/usr/bin/env tsx
/**
 * Pack @mergesignal/shared and assert publication hygiene:
 * - registry-compatible dependencies in packed manifest
 * - no compiled test artifacts or test-only fixtures in tarball
 * - no @mergesignal/contracts runtime or declaration dependency
 * - required runtime exports present
 * - mandatory unauthenticated npmjs external install smoke
 */
import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SHARED_DIR = path.join(ROOT, "packages/shared");

const INVALID_PROTOCOL = /^(catalog:|workspace:|link:|file:)/;
const PRIVATE_PACKAGE = "@mergesignal/contracts";

function run(command: string, cwd = ROOT, env?: NodeJS.ProcessEnv): string {
  return execSync(command, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: env ?? process.env,
  });
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
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

function main(): void {
  const version = JSON.parse(
    readFileSync(path.join(SHARED_DIR, "package.json"), "utf8"),
  ).version as string;

  const tarballName = `mergesignal-shared-${version}.tgz`;
  const tarballPath = path.join(SHARED_DIR, tarballName);

  if (existsSync(tarballPath)) rmSync(tarballPath);

  run("npm pack", SHARED_DIR);

  assert(existsSync(tarballPath), `Expected tarball at ${tarballPath}`);

  const listing = run(`tar -tzf ${tarballName}`, SHARED_DIR);
  const files = listing.trim().split("\n").filter(Boolean);

  const testFiles = files.filter((f) => /\.test\.(js|d\.ts)$/.test(f));
  const fixtureFiles = files.filter((f) =>
    /package\/dist\/.*\/fixtures\//.test(f),
  );

  assert(
    testFiles.length === 0,
    `Packed test artifacts found: ${testFiles.join(", ")}`,
  );
  assert(
    fixtureFiles.length === 0,
    `Packed fixture artifacts found: ${fixtureFiles.join(", ")}`,
  );
  assert(
    files.some((f) => f.endsWith("package/dist/lockfileEvidence.js")),
    "Missing dist/lockfileEvidence.js in tarball",
  );
  assert(
    files.some((f) => f.endsWith("package/dist/lockfileEvidence.d.ts")),
    "Missing dist/lockfileEvidence.d.ts in tarball",
  );
  assert(
    files.some((f) => f.endsWith("package/dist/assessment/schema.js")),
    "Missing dist/assessment/schema.js in tarball",
  );

  const packedManifest = JSON.parse(
    run(`tar -xOf ${tarballName} package/package.json`, SHARED_DIR),
  ) as {
    name: string;
    version: string;
    dependencies?: Record<string, string>;
    publishConfig?: { access?: string };
  };

  assert(
    packedManifest.name === "@mergesignal/shared",
    "Unexpected package name",
  );
  assert(packedManifest.version === version, "Packed version mismatch");
  assert(
    packedManifest.publishConfig?.access === "public",
    "Packed package must declare public access",
  );
  assert(
    packedManifest.dependencies?.[PRIVATE_PACKAGE] === undefined,
    `Packed manifest must not depend on ${PRIVATE_PACKAGE}`,
  );

  for (const [name, depVersion] of Object.entries(
    packedManifest.dependencies ?? {},
  )) {
    assert(
      !INVALID_PROTOCOL.test(depVersion),
      `Packed dependency ${name} uses invalid protocol: ${depVersion}`,
    );
    assert(
      !name.startsWith("@mergesignal/"),
      `Packed dependency ${name} must not be a private MergeSignal package`,
    );
  }

  const distDir = path.join(SHARED_DIR, "dist");
  const declarationRefs = collectDeclarationFiles(distDir).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return source.includes(PRIVATE_PACKAGE) ? [file] : [];
  });
  assert(
    declarationRefs.length === 0,
    `Declaration files reference ${PRIVATE_PACKAGE}: ${declarationRefs.join(", ")}`,
  );

  process.stdout.write(
    [
      "shared pack artifact check OK",
      `version=${version}`,
      `files=${files.length}`,
      `testArtifacts=0`,
      `fixtureArtifacts=0`,
      `privateDeps=0`,
    ].join(" | ") + "\n",
  );

  const smokeDir = mkdtempSync(
    path.join(tmpdir(), "mergesignal-shared-public-smoke-"),
  );
  try {
    const consumerDir = path.join(smokeDir, "consumer");
    mkdirSync(consumerDir, { recursive: true });
    cpSync(tarballPath, path.join(consumerDir, tarballName));

    writeFileSync(
      path.join(consumerDir, ".npmrc"),
      "registry=https://registry.npmjs.org/\n",
    );

    writeFileSync(
      path.join(consumerDir, "package.json"),
      JSON.stringify(
        {
          name: "shared-smoke-consumer",
          private: true,
          type: "module",
          devDependencies: {
            typescript: "^5.3.0",
          },
        },
        null,
        2,
      ) + "\n",
    );

    const cleanEnv = {
      ...process.env,
      NODE_AUTH_TOKEN: undefined,
      NPM_TOKEN: undefined,
      NPM_CONFIG_USERCONFIG: path.join(smokeDir, "empty-npmrc"),
    };
    writeFileSync(
      cleanEnv.NPM_CONFIG_USERCONFIG!,
      "registry=https://registry.npmjs.org/\n",
    );

    run(
      `npm install ./${tarballName} --registry=https://registry.npmjs.org`,
      consumerDir,
      cleanEnv,
    );
    run(
      "npm install --registry=https://registry.npmjs.org",
      consumerDir,
      cleanEnv,
    );

    const depTree = run("npm ls --all --json", consumerDir, cleanEnv);
    assert(
      !depTree.includes(PRIVATE_PACKAGE),
      `Dependency tree must not include ${PRIVATE_PACKAGE}`,
    );

    writeFileSync(
      path.join(consumerDir, "runtime-smoke.mjs"),
      `import {
  LOCKFILE_UNCERTAINTY_WARNING_CODES,
  PREPARATION_UNCERTAINTY_WARNING_CODES,
  hasPreparationUncertaintyWarnings,
  isLockfileUncertaintyWarningCode,
  ENGINE_OUTPUT_SCAN_ABI,
  ASSESSMENT_ABI,
  parseAssessmentOrThrow,
  extractAuthoredCommunication,
  buildScanPresentationBundle,
} from "@mergesignal/shared";

if (!LOCKFILE_UNCERTAINTY_WARNING_CODES.includes("lockfile_evidence_incomplete")) {
  throw new Error("missing lockfile uncertainty code");
}
if (!PREPARATION_UNCERTAINTY_WARNING_CODES.includes("code_fetch_failed")) {
  throw new Error("missing preparation uncertainty code");
}
if (isLockfileUncertaintyWarningCode("lockfile_diff_empty")) {
  throw new Error("retired code must not be uncertainty");
}
if (
  hasPreparationUncertaintyWarnings([
    { code: "code_fetch_skipped", message: "skipped" },
  ])
) {
  throw new Error("informational warning must not count as uncertainty");
}
if (ENGINE_OUTPUT_SCAN_ABI !== "4") {
  throw new Error("representative export missing");
}
if (ASSESSMENT_ABI !== "4") {
  throw new Error("assessment ABI missing");
}
const assessment = parseAssessmentOrThrow({
  reviewFocalPoint: {
    episodeShape: "single_anchor",
    anchors: ["pkg-a"],
    election: { grounding: [], exclusions: [] },
  },
  reachScope: { packages: ["pkg-a"], maxBucket: "low" },
  verificationScope: { packages: ["pkg-a"], focus: [] },
  posture: "safe",
  confidence: "high",
  primaryConcern: null,
  concerns: [],
  factors: [],
  changeClasses: ["tooling_maintenance"],
  presentation: {
    narrativeIntensity: "minimal",
    reachVisibility: "hidden",
    verificationIntensity: "none",
    insightEmissionFloor: "none",
    reportMode: "lightweight_pr_graph_baseline",
  },
  reasoning: ["ok"],
  confidenceRationale: "ok",
});
void extractAuthoredCommunication(assessment);
void buildScanPresentationBundle;
console.log("runtime-smoke-ok");
`,
    );

    const runtimeOut = run(
      "node runtime-smoke.mjs",
      consumerDir,
      cleanEnv,
    ).trim();
    assert(
      runtimeOut === "runtime-smoke-ok",
      `Unexpected runtime smoke output: ${runtimeOut}`,
    );

    writeFileSync(
      path.join(consumerDir, "types-smoke.ts"),
      `import type {
  LockfileEvidenceStatus,
  LockfileUncertaintyWarningCode,
  PreparationUncertaintyWarningCode,
  ScanRequest,
  Assessment,
  MergeConcernKind,
} from "@mergesignal/shared";
import { hasLockfileUncertaintyWarnings } from "@mergesignal/shared";

const status: LockfileEvidenceStatus = { kind: "verified", delta: "empty" };
const code: LockfileUncertaintyWarningCode = "lockfile_evidence_incomplete";
const prep: PreparationUncertaintyWarningCode = "code_fetch_failed";
const request: ScanRequest = { repoId: "r1", dependencyGraph: {} };
const concern: MergeConcernKind = "confirmed_runtime_usage";
const assessment: Assessment = {
  reviewFocalPoint: {
    episodeShape: "single_anchor",
    anchors: ["pkg-a"],
    election: { grounding: [], exclusions: [] },
  },
  reachScope: { packages: ["pkg-a"], maxBucket: "low" },
  verificationScope: { packages: ["pkg-a"], focus: [] },
  posture: "safe",
  confidence: "high",
  primaryConcern: null,
  concerns: [],
  factors: [],
  changeClasses: ["tooling_maintenance"],
  presentation: {
    narrativeIntensity: "minimal",
    reachVisibility: "hidden",
    verificationIntensity: "none",
    insightEmissionFloor: "none",
    reportMode: "lightweight_pr_graph_baseline",
  },
  reasoning: ["ok"],
  confidenceRationale: "ok",
};
void status;
void code;
void prep;
void request;
void concern;
void assessment;
void hasLockfileUncertaintyWarnings([]);
`,
    );

    writeFileSync(
      path.join(consumerDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "bundler",
            strict: true,
            skipLibCheck: true,
            lib: ["ES2022"],
          },
          include: ["types-smoke.ts"],
        },
        null,
        2,
      ) + "\n",
    );

    run("npm exec -- tsc --noEmit -p tsconfig.json", consumerDir, cleanEnv);
    process.stdout.write("unauthenticated external install smoke OK\n");
  } finally {
    rmSync(smokeDir, { recursive: true, force: true });
    rmSync(tarballPath, { force: true });
  }
}

main();
