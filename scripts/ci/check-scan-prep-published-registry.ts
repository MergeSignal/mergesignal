#!/usr/bin/env tsx
/**
 * Read-only post-publication verification for @mergesignal/scan-prep on npmjs.
 * Public package — no npm token required.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { assertPublishedRegistryConsumerLockfile } from "./lib/scan-prep-published-registry-lockfile.ts";
const PACKAGE_NAME = "@mergesignal/scan-prep";
const EXPECTED_SHARED_VERSION = "0.13.0";
const NPMJS_REGISTRY = "https://registry.npmjs.org/";
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function parseVersion(argv: string[]): string {
  const flag = argv.find((arg) => arg.startsWith("--version="));
  const version =
    flag?.split("=")[1]?.trim() ??
    process.env.SCAN_PREP_PUBLISH_VERSION?.trim();
  if (!version) {
    throw new Error(
      "Version required: --version=X.Y.Z or SCAN_PREP_PUBLISH_VERSION",
    );
  }
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(`Invalid version: ${version}`);
  }
  return version;
}

function run(command: string, cwd: string, env?: NodeJS.ProcessEnv): string {
  return execSync(command, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env,
  }).trim();
}

function view(version: string, field: string): string {
  return run(
    `npm view ${PACKAGE_NAME}@${version} ${field} --registry=${NPMJS_REGISTRY}`,
    process.cwd(),
    {
      ...process.env,
      NODE_AUTH_TOKEN: undefined,
      NPM_TOKEN: undefined,
    },
  );
}

function verifyMetadata(version: string): void {
  if (view(version, "version") !== version) {
    throw new Error(`${PACKAGE_NAME}@${version} metadata version mismatch`);
  }
  const access = view(version, "publishConfig.access");
  if (access !== "public") {
    throw new Error(`published package access must be public (got: ${access})`);
  }
  const sharedDep = view(version, "dependencies.@mergesignal/shared");
  if (sharedDep !== EXPECTED_SHARED_VERSION) {
    throw new Error(
      `published @mergesignal/shared dependency must be exact ${EXPECTED_SHARED_VERSION}`,
    );
  }
  process.stdout.write(
    `  metadata: ${PACKAGE_NAME}@${version} public on npmjs\n`,
  );
}

function verifyIsolatedInstall(version: string): void {
  const consumerDir = mkdtempSync(
    path.join(tmpdir(), "ms-scan-prep-published-consumer-"),
  );
  const cleanEnv = {
    ...process.env,
    NODE_AUTH_TOKEN: undefined,
    NPM_TOKEN: undefined,
    NPM_CONFIG_USERCONFIG: path.join(consumerDir, ".npmrc"),
  };
  try {
    writeFileSync(
      path.join(consumerDir, "package.json"),
      `${JSON.stringify(
        {
          name: "scan-prep-published-registry-smoke",
          private: true,
          type: "module",
          dependencies: {
            [PACKAGE_NAME]: version,
            "@mergesignal/shared": EXPECTED_SHARED_VERSION,
          },
          devDependencies: {
            typescript: "^5.9.3",
          },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      path.join(consumerDir, ".npmrc"),
      `registry=${NPMJS_REGISTRY}\n@mergesignal:registry=${NPMJS_REGISTRY}\n`,
    );

    run("pnpm install", consumerDir, cleanEnv);
    const lock = readFileSync(path.join(consumerDir, "pnpm-lock.yaml"), "utf8");
    assertPublishedRegistryConsumerLockfile(lock, {
      scanPrepPackageName: PACKAGE_NAME,
      scanPrepVersion: version,
      sharedVersion: EXPECTED_SHARED_VERSION,
    });

    run(
      `node --input-type=module -e "import('${PACKAGE_NAME}').then((m)=>{if(typeof m.prepareScanContext!=='function')throw new Error('root')})"`,
      consumerDir,
      cleanEnv,
    );
    run(
      `node --input-type=module -e "import('${PACKAGE_NAME}/lockfile').then((m)=>{if(typeof m.hasVerifiedLockfileIngress!=='function')throw new Error('lockfile')})"`,
      consumerDir,
      cleanEnv,
    );

    writeFileSync(
      path.join(consumerDir, "tsconfig.json"),
      `${JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            skipLibCheck: true,
          },
          include: ["smoke.ts"],
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      path.join(consumerDir, "smoke.ts"),
      `import { prepareScanContext } from '${PACKAGE_NAME}';\n` +
        `import { hasVerifiedLockfileIngress } from '${PACKAGE_NAME}/lockfile';\n` +
        `void prepareScanContext;\n` +
        `void hasVerifiedLockfileIngress;\n`,
    );
    run("pnpm exec tsc --noEmit -p tsconfig.json", consumerDir, cleanEnv);
    process.stdout.write(
      `  isolated install: ${PACKAGE_NAME}@${version} + @mergesignal/shared@${EXPECTED_SHARED_VERSION} from npmjs\n`,
    );
  } finally {
    rmSync(consumerDir, { recursive: true, force: true });
  }
}

function main(): void {
  const version = parseVersion(process.argv.slice(2));
  process.stdout.write("check:scan-prep-published-registry report\n");
  process.stdout.write(`  registry: ${NPMJS_REGISTRY}\n`);
  process.stdout.write(`  version: ${version}\n`);
  verifyMetadata(version);
  verifyIsolatedInstall(version);
  process.stdout.write("check:scan-prep-published-registry OK\n");
}

main();
