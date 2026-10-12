#!/usr/bin/env tsx
/**
 * Read-only post-publication verification for @mergesignal/scan-prep on npmjs.
 * Public package — no npm token required.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertPublishedRegistryConsumerLockfile } from "./lib/scan-prep-published-registry-lockfile.ts";
import { cleanNpmEnv } from "./lib/npmjs-registry.ts";
import {
  type NpmjsPackageVersionDocument,
  queryNpmjsExactPackageVersionPublication,
  readSharedDependencyPinFromNpmjsPackageVersionDocument,
} from "./lib/npmjs-package-version-availability.ts";
import { readRootPackageManagerAuthority } from "./lib/root-package-manager.ts";
import { readScanPrepReleaseIdentity } from "./lib/scan-prep-release-identity.ts";

export const PACKAGE_NAME = "@mergesignal/scan-prep";
const NPMJS_REGISTRY = "https://registry.npmjs.org/";
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/** Exact-version HTTP contract; scan-prep publish can lag `npm view` slightly longer than Shared. */
export const NPMJS_REGISTRY_PUBLICATION_MAX_ATTEMPTS = 36;
export const NPMJS_REGISTRY_PUBLICATION_RETRY_DELAY_SECONDS = 5;

export type PublishedRegistryConsumerPackageJson = {
  name: string;
  private: boolean;
  type: string;
  packageManager: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

export function buildPublishedRegistryConsumerPackageJson(
  scanPrepVersion: string,
  expectedSharedVersion: string,
): PublishedRegistryConsumerPackageJson {
  return {
    name: "scan-prep-published-registry-smoke",
    private: true,
    type: "module",
    packageManager: readRootPackageManagerAuthority(),
    dependencies: {
      [PACKAGE_NAME]: scanPrepVersion,
      "@mergesignal/shared": expectedSharedVersion,
    },
    devDependencies: {
      typescript: "^5.9.3",
    },
  };
}

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

function sleep(seconds: number): void {
  execSync(`sleep ${seconds}`);
}

export type WaitForPublishedScanPrepDocumentDeps = {
  query?: typeof queryNpmjsExactPackageVersionPublication;
  sleep?: (seconds: number) => void;
  maxAttempts?: number;
  retryDelaySeconds?: number;
};

/**
 * Waits for the exact-version registry HTTP document (not `npm view`), which
 * matches `verify-shared-on-npmjs.sh` and post-publish propagation behavior.
 */
export async function waitForPublishedScanPrepDocument(
  version: string,
  deps: WaitForPublishedScanPrepDocumentDeps = {},
): Promise<NpmjsPackageVersionDocument> {
  const query = deps.query ?? queryNpmjsExactPackageVersionPublication;
  const sleepFn = deps.sleep ?? sleep;
  const maxAttempts =
    deps.maxAttempts ?? NPMJS_REGISTRY_PUBLICATION_MAX_ATTEMPTS;
  const retryDelaySeconds =
    deps.retryDelaySeconds ?? NPMJS_REGISTRY_PUBLICATION_RETRY_DELAY_SECONDS;

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await query(PACKAGE_NAME, version);
    if (result.kind === "published") {
      return result.document;
    }

    if (result.kind === "unavailable") {
      lastError = new Error(result.message);
    } else {
      lastError = new Error(
        `${PACKAGE_NAME}@${version} not found on npmjs (exact-version HTTP 404)`,
      );
    }

    if (attempt < maxAttempts) {
      process.stderr.write(
        `  registry publication attempt ${attempt}/${maxAttempts} not ready; retrying in ${retryDelaySeconds}s...\n`,
      );
      sleepFn(retryDelaySeconds);
    }
  }

  throw (
    lastError ??
    new Error(
      `registry publication evidence missing for ${PACKAGE_NAME}@${version}`,
    )
  );
}

async function verifyMetadata(
  version: string,
  expectedSharedVersion: string,
): Promise<void> {
  const document = await waitForPublishedScanPrepDocument(version);
  if (document.version !== version) {
    throw new Error(`${PACKAGE_NAME}@${version} metadata version mismatch`);
  }
  const access = document.publishConfig?.access;
  if (access !== "public") {
    throw new Error(`published package access must be public (got: ${access})`);
  }
  const sharedDep = readSharedDependencyPinFromNpmjsPackageVersionDocument(
    document,
    "@mergesignal/shared",
  );
  if (sharedDep !== expectedSharedVersion) {
    throw new Error(
      `published @mergesignal/shared dependency must be exact ${expectedSharedVersion}`,
    );
  }
  process.stdout.write(
    `  metadata: ${PACKAGE_NAME}@${version} public on npmjs\n`,
  );
}

function verifyIsolatedInstall(
  version: string,
  expectedSharedVersion: string,
): void {
  const consumerDir = mkdtempSync(
    path.join(tmpdir(), "ms-scan-prep-published-consumer-"),
  );
  const cleanEnv = {
    ...cleanNpmEnv(),
    NPM_CONFIG_USERCONFIG: path.join(consumerDir, ".npmrc"),
  };
  try {
    const consumerPackageJson = buildPublishedRegistryConsumerPackageJson(
      version,
      expectedSharedVersion,
    );
    writeFileSync(
      path.join(consumerDir, "package.json"),
      `${JSON.stringify(consumerPackageJson, null, 2)}\n`,
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
      sharedVersion: expectedSharedVersion,
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
      `  isolated install: ${PACKAGE_NAME}@${version} + @mergesignal/shared@${expectedSharedVersion} from npmjs\n`,
    );
  } finally {
    rmSync(consumerDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const version = parseVersion(process.argv.slice(2));
  const releaseIdentity = readScanPrepReleaseIdentity(version);
  process.stdout.write("check:scan-prep-published-registry report\n");
  process.stdout.write(`  registry: ${NPMJS_REGISTRY}\n`);
  process.stdout.write(`  version: ${version}\n`);
  process.stdout.write(`  release tag: ${releaseIdentity.tag}\n`);
  process.stdout.write(
    `  expected @mergesignal/shared: ${releaseIdentity.sharedDependencyVersion} (from ${releaseIdentity.tag})\n`,
  );
  await verifyMetadata(version, releaseIdentity.sharedDependencyVersion);
  verifyIsolatedInstall(version, releaseIdentity.sharedDependencyVersion);
  process.stdout.write("check:scan-prep-published-registry OK\n");
}

const isDirectRun =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : String(error ?? "unknown error");
    console.error(message);
    process.exitCode = 1;
  });
}
