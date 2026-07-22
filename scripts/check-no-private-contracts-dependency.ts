#!/usr/bin/env tsx
/**
 * CI guard: public mergesignal must not depend on private engine contracts packages.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FORBIDDEN_PACKAGE_NAMES = [
  "@mergesignal/contracts",
  "@mergesignal-engine/contracts",
] as const;

async function collectPackageJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".turbo" ||
      entry.name === "dist"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectPackageJsonFiles(full)));
    } else if (entry.name === "package.json") {
      files.push(full);
    }
  }
  return files;
}

async function main(): Promise<void> {
  const violations: string[] = [];
  const packageFiles = await collectPackageJsonFiles(ROOT);

  for (const file of packageFiles) {
    const rel = path.relative(ROOT, file);
    const pkg = JSON.parse(await readFile(file, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const sections = [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ] as const;
    for (const section of sections) {
      const deps = pkg[section];
      if (!deps) continue;
      for (const forbidden of FORBIDDEN_PACKAGE_NAMES) {
        if (forbidden in deps) {
          violations.push(`${rel}: ${section} must not reference ${forbidden}`);
        }
      }
    }
  }

  const lockPath = path.join(ROOT, "pnpm-lock.yaml");
  try {
    const lock = await readFile(lockPath, "utf8");
    for (const forbidden of FORBIDDEN_PACKAGE_NAMES) {
      if (lock.includes(`${forbidden}@`) || lock.includes(`"${forbidden}"`)) {
        violations.push(
          `pnpm-lock.yaml must not resolve ${forbidden} — regenerate lockfile after removing private contracts`,
        );
        break;
      }
    }
  } catch {
    violations.push("pnpm-lock.yaml missing");
  }

  if (violations.length > 0) {
    console.error("check:no-private-contracts FAILED:\n");
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }

  console.log("check:no-private-contracts OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
