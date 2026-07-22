#!/usr/bin/env tsx
/**
 * CI guard: published Scan Preparation export surface matches scan-prep-api.md.
 * Static analysis only — does not execute preparation modules (avoids GitHub client load).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  APPROVED_LOCKFILE_RUNTIME,
  APPROVED_LOCKFILE_TYPES,
  APPROVED_PACKAGE_EXPORTS,
  APPROVED_ROOT_RUNTIME,
  APPROVED_ROOT_TYPES,
  PROHIBITED_RUNTIME,
} from "../packages/scan-prep/approved-export-surface.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(SCRIPT_DIR, "../packages/scan-prep");

function runtimeExportsFromBarrel(relativePath: string): string[] {
  const src = readFileSync(resolve(PKG_ROOT, relativePath), "utf8");
  const blocks = [...src.matchAll(/export\s*\{([^}]+)\}/gs)];
  if (blocks.length === 0) {
    throw new Error(`Could not parse export blocks in ${relativePath}`);
  }

  const names = new Set<string>();
  for (const block of blocks) {
    const body = block[1] ?? "";
    for (const part of body.split(",")) {
      const trimmed = part.trim();
      if (!trimmed || trimmed.startsWith("type ")) continue;
      const asMatch = trimmed.match(/\bas\s+(\w+)/);
      if (asMatch?.[1]) {
        names.add(asMatch[1]);
        continue;
      }
      const name = trimmed.split(/\s+/)[0] ?? trimmed;
      if (!name.startsWith("type ")) {
        names.add(name.replace(/^type\s+/, ""));
      }
    }
  }

  return [...names];
}

function declarationExports(relativePath: string): {
  values: string[];
  types: string[];
} {
  const content = readFileSync(resolve(PKG_ROOT, relativePath), "utf8");
  const blocks = [...content.matchAll(/export\s*\{([^}]+)\}/gs)];
  if (blocks.length === 0) {
    throw new Error(`Could not parse declaration exports in ${relativePath}`);
  }

  const values: string[] = [];
  const types: string[] = [];
  for (const block of blocks) {
    const body = block[1] ?? "";
    for (const part of body.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("type ")) {
        types.push(trimmed.replace(/^type\s+/, "").trim());
        continue;
      }
      values.push(trimmed.split(/\s+/)[0] ?? trimmed);
    }
  }

  return { values, types };
}

function assertEqualSets(
  label: string,
  actual: string[],
  expected: readonly string[],
): void {
  const a = [...actual].sort();
  const e = [...expected].sort();
  if (JSON.stringify(a) !== JSON.stringify(e)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`,
    );
  }
}

function main(): void {
  const pkg = JSON.parse(
    readFileSync(resolve(PKG_ROOT, "package.json"), "utf8"),
  ) as { exports: Record<string, { import: string; types: string }> };

  assertEqualSets("package.json export keys", Object.keys(pkg.exports).sort(), [
    ...APPROVED_PACKAGE_EXPORTS,
  ]);

  if (!pkg.exports["./lockfile"]) {
    throw new Error("package.json missing ./lockfile export");
  }

  const rootBarrel = runtimeExportsFromBarrel("src/index.ts");
  const lockfileBarrel = runtimeExportsFromBarrel("src/lockfile.ts");

  assertEqualSets(
    "root barrel runtime exports",
    rootBarrel,
    APPROVED_ROOT_RUNTIME,
  );
  assertEqualSets(
    "lockfile barrel runtime exports",
    lockfileBarrel,
    APPROVED_LOCKFILE_RUNTIME,
  );

  for (const symbol of PROHIBITED_RUNTIME) {
    if (rootBarrel.includes(symbol) || lockfileBarrel.includes(symbol)) {
      throw new Error(`prohibited export surfaced in barrel: ${symbol}`);
    }
  }

  const rootDecl = declarationExports("dist/index.d.ts");
  const lockfileDecl = declarationExports("dist/lockfile.d.ts");

  assertEqualSets(
    "root declaration values",
    rootDecl.values,
    APPROVED_ROOT_RUNTIME,
  );
  assertEqualSets(
    "root declaration types",
    rootDecl.types,
    APPROVED_ROOT_TYPES,
  );
  assertEqualSets(
    "lockfile declaration values",
    lockfileDecl.values,
    APPROVED_LOCKFILE_RUNTIME,
  );
  assertEqualSets(
    "lockfile declaration types",
    lockfileDecl.types,
    APPROVED_LOCKFILE_TYPES,
  );

  if (
    rootDecl.values.some((symbol) =>
      (APPROVED_LOCKFILE_RUNTIME as readonly string[]).includes(symbol),
    )
  ) {
    throw new Error("lockfile runtime export found on root declaration");
  }

  for (const symbol of PROHIBITED_RUNTIME) {
    const rootDeclText = readFileSync(
      resolve(PKG_ROOT, "dist/index.d.ts"),
      "utf8",
    );
    const lockfileDeclText = readFileSync(
      resolve(PKG_ROOT, "dist/lockfile.d.ts"),
      "utf8",
    );
    if (rootDeclText.includes(symbol) || lockfileDeclText.includes(symbol)) {
      throw new Error(`built declarations expose prohibited symbol: ${symbol}`);
    }
  }

  process.stdout.write("scan-prep export surface check OK\n");
}

main();
