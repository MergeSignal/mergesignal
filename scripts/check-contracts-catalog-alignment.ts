#!/usr/bin/env tsx
/**
 * CI guard: @mergesignal/contracts must resolve from GitHub Packages via pnpm catalog only.
 */
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EXPECTED_CONTRACTS_PACKAGE_VERSION } from "./contracts-version-expectations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOCKFILE = path.join(ROOT, "pnpm-lock.yaml");
const WORKSPACE_FILE = path.join(ROOT, "pnpm-workspace.yaml");
const RESOLVE_FROM = path.join(ROOT, "packages/shared/package.json");

const require = createRequire(RESOLVE_FROM);

const CATALOG_SPECIFIER = "catalog:";
const EXACT_VERSION_RE = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;
const FORBIDDEN_CONTRACTS_SPECIFIERS = /^(?:workspace:|file:|link:)/;
const RANGE_PREFIX_RE = /^[\^~><=]/;

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

async function collectConsumerPackageJsonFiles(): Promise<string[]> {
  const files: string[] = [];
  for (const scope of ["apps", "packages"] as const) {
    const scopeDir = path.join(ROOT, scope);
    if (!existsSync(scopeDir)) continue;
    const entries = await readdir(scopeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const file = path.join(scopeDir, entry.name, "package.json");
      if (existsSync(file)) files.push(file);
    }
  }
  return files;
}

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Failed to parse ${label}`);
  }
}

async function checkWorkspaceCatalog(violations: string[]): Promise<void> {
  if (!existsSync(WORKSPACE_FILE)) {
    violations.push(
      "pnpm-workspace.yaml is missing — catalog is required for @mergesignal/contracts",
    );
    return;
  }
  const workspace = await readFile(WORKSPACE_FILE, "utf8");
  const match = workspace.match(
    /['"]@mergesignal\/contracts['"]:\s*([^\s#]+)/,
  );
  if (!match) {
    violations.push(
      "pnpm-workspace.yaml must declare catalog @mergesignal/contracts — single version authority",
    );
    return;
  }
  const catalogVersion = match[1]!.replace(/['"]/g, "");
  if (
    RANGE_PREFIX_RE.test(catalogVersion) ||
    !EXACT_VERSION_RE.test(catalogVersion)
  ) {
    violations.push(
      `pnpm-workspace.yaml catalog @mergesignal/contracts must be an exact version (got "${catalogVersion}")`,
    );
    return;
  }
  if (catalogVersion !== EXPECTED_CONTRACTS_PACKAGE_VERSION) {
    violations.push(
      `catalog version "${catalogVersion}" !== EXPECTED_CONTRACTS_PACKAGE_VERSION "${EXPECTED_CONTRACTS_PACKAGE_VERSION}" — bump both pnpm-workspace.yaml and scripts/contracts-version-expectations.ts together`,
    );
  }
}

async function checkContractsDependencyPins(
  violations: string[],
): Promise<void> {
  const packageFiles = await collectConsumerPackageJsonFiles();
  for (const file of packageFiles) {
    const pkg = parseJson<PackageJson>(await readFile(file, "utf8"), file);
    const rel = path.relative(ROOT, file);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const specifier = deps["@mergesignal/contracts"];
    if (specifier == null) continue;

    if (
      FORBIDDEN_CONTRACTS_SPECIFIERS.test(specifier) ||
      RANGE_PREFIX_RE.test(specifier)
    ) {
      violations.push(
        `${rel}: @mergesignal/contracts must use "${CATALOG_SPECIFIER}" (got forbidden "${specifier}")`,
      );
      continue;
    }
    if (EXACT_VERSION_RE.test(specifier)) {
      violations.push(
        `${rel}: @mergesignal/contracts must use "${CATALOG_SPECIFIER}" — literal version "${specifier}" duplicates pnpm-workspace.yaml catalog authority`,
      );
      continue;
    }
    if (specifier !== CATALOG_SPECIFIER) {
      violations.push(
        `${rel}: @mergesignal/contracts must use "${CATALOG_SPECIFIER}" (got "${specifier}")`,
      );
    }
  }
}

async function checkLockfileResolution(violations: string[]): Promise<void> {
  if (!existsSync(LOCKFILE)) {
    violations.push("pnpm-lock.yaml is missing");
    return;
  }
  const lock = await readFile(LOCKFILE, "utf8");
  if (lock.includes("@mergesignal/contracts@file:")) {
    violations.push(
      "pnpm-lock.yaml must not resolve @mergesignal/contracts from file: — use GitHub Packages via catalog",
    );
  }
  const pkgKey = `'@mergesignal/contracts@${EXPECTED_CONTRACTS_PACKAGE_VERSION}':`;
  const keyIndex = lock.indexOf(pkgKey);
  if (keyIndex === -1) {
    violations.push(
      `pnpm-lock.yaml does not resolve @mergesignal/contracts@${EXPECTED_CONTRACTS_PACKAGE_VERSION}`,
    );
    return;
  }
  const slice = lock.slice(keyIndex, keyIndex + 600);
  if (/link:/.test(slice) || /file:/.test(slice)) {
    violations.push(
      `pnpm-lock.yaml resolves @mergesignal/contracts@${EXPECTED_CONTRACTS_PACKAGE_VERSION} from a local link — registry install required`,
    );
  }
  if (!/integrity:\s*sha512-/.test(slice)) {
    violations.push(
      `pnpm-lock.yaml @mergesignal/contracts@${EXPECTED_CONTRACTS_PACKAGE_VERSION} is missing registry integrity — must not be vendored locally`,
    );
  }
}

async function checkInstalledContractsPackage(
  violations: string[],
): Promise<void> {
  let contractsPkgPath: string;
  try {
    contractsPkgPath = path.join(
      path.dirname(require.resolve("@mergesignal/contracts")),
      "package.json",
    );
  } catch {
    violations.push(
      "Could not resolve @mergesignal/contracts — run pnpm install before check:contracts-catalog",
    );
    return;
  }
  if (!existsSync(contractsPkgPath)) {
    violations.push("Resolved @mergesignal/contracts package.json is missing");
    return;
  }
  const installed = parseJson<{ version?: string }>(
    await readFile(contractsPkgPath, "utf8"),
    contractsPkgPath,
  );
  if (installed.version !== EXPECTED_CONTRACTS_PACKAGE_VERSION) {
    violations.push(
      `installed @mergesignal/contracts is ${installed.version ?? "unknown"} but repo expects ${EXPECTED_CONTRACTS_PACKAGE_VERSION}`,
    );
  }
}

async function main(): Promise<void> {
  const violations: string[] = [];

  await checkWorkspaceCatalog(violations);
  await checkContractsDependencyPins(violations);
  await checkLockfileResolution(violations);
  await checkInstalledContractsPackage(violations);

  if (violations.length > 0) {
    console.error("check:contracts-catalog FAILED:\n");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    console.error(
      "\nSee docs/engineering/releasing.md for the contracts publish and catalog bump sequence.",
    );
    process.exit(1);
  }

  console.log(
    `check:contracts-catalog OK (@mergesignal/contracts@${EXPECTED_CONTRACTS_PACKAGE_VERSION})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
