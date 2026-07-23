/**
 * Isolated external-consumer validation for a @mergesignal/scan-prep release candidate.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  EXPECTED_SHARED_VERSION,
  NPMJS_REGISTRY,
  PACKAGE_NAME,
  type ScanPrepPackResult,
  digestSha512OfFile,
  readSourcePackageJsonRaw,
} from "./scan-prep-pack-artifact.ts";

function run(command: string, cwd: string, env?: NodeJS.ProcessEnv): string {
  return execSync(command, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: env ?? process.env,
  }).trim();
}

export type IsolatedInstallResult = {
  candidatePath: string;
  version: string;
  digestSha512: string;
};

export function runScanPrepIsolatedInstall(input: {
  candidate: ScanPrepPackResult;
  verifySourceUnchanged?: boolean;
}): IsolatedInstallResult {
  const { candidate } = input;
  const verifySourceUnchanged = input.verifySourceUnchanged ?? true;
  const sourceBefore = verifySourceUnchanged
    ? readSourcePackageJsonRaw()
    : undefined;
  const packedAbs = candidate.tarballPath;
  const digestBefore = digestSha512OfFile(packedAbs);
  const version = candidate.version;

  const consumerDir = mkdtempSync(
    path.join(tmpdir(), "ms-scan-prep-consumer-"),
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
          name: "scan-prep-isolated-install-smoke",
          private: true,
          type: "module",
          dependencies: {
            [PACKAGE_NAME]: `file:${packedAbs}`,
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
    const installedVersion = JSON.parse(
      readFileSync(
        path.join(
          consumerDir,
          "node_modules/@mergesignal/scan-prep/package.json",
        ),
        "utf8",
      ),
    ).version as string;

    if (installedVersion !== version) {
      throw new Error(
        `installed ${PACKAGE_NAME} version mismatch (expected ${version}, got ${installedVersion})`,
      );
    }
    if (!lock.includes(PACKAGE_NAME)) {
      throw new Error(`lockfile missing ${PACKAGE_NAME}`);
    }
    if (!/@mergesignal\/scan-prep@file:/i.test(lock)) {
      throw new Error(
        `lockfile must resolve ${PACKAGE_NAME} from packed candidate tarball`,
      );
    }
    if (/npm\.pkg\.github\.com/i.test(lock)) {
      throw new Error("lockfile must not reference GitHub Packages");
    }
    if (/link:|file:.*shared/i.test(lock)) {
      throw new Error(
        "lockfile must not use link:/file: for @mergesignal/shared",
      );
    }
    if (!lock.includes(`@mergesignal/shared@${EXPECTED_SHARED_VERSION}`)) {
      throw new Error(
        `lockfile missing @mergesignal/shared@${EXPECTED_SHARED_VERSION}`,
      );
    }
    if (!/integrity:\s*sha512-/i.test(lock)) {
      throw new Error("lockfile missing npmjs integrity metadata");
    }

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

    if (verifySourceUnchanged && sourceBefore !== undefined) {
      const sourceAfter = readSourcePackageJsonRaw();
      if (sourceBefore !== sourceAfter) {
        throw new Error("isolated install must not modify source package.json");
      }
    }

    const digestAfter = digestSha512OfFile(packedAbs);
    if (digestBefore !== digestAfter) {
      throw new Error(
        "candidate tarball bytes changed during isolated install",
      );
    }

    return {
      candidatePath: packedAbs,
      version,
      digestSha512: digestAfter,
    };
  } finally {
    rmSync(consumerDir, { recursive: true, force: true });
  }
}
