#!/usr/bin/env tsx
/**
 * CI guard: public mergesignal package-manager authority must stay filesystem-self-contained.
 * Does not scan docs, workflows, or source prose — only package.json, pnpm-workspace.yaml, pnpm-lock.yaml.
 */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "..");

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

const GLOB_MAGIC = /[*?[\{]/;

export function isContained(targetAbs: string, rootAbs: string): boolean {
  const target = path.resolve(targetAbs);
  const root = path.resolve(rootAbs);
  if (target === root) return true;
  return target.startsWith(root + path.sep);
}

function normalizeFsPathSegment(segment: string): string {
  const trimmed = segment.trim();
  if (trimmed.startsWith("file://")) {
    return fileURLToPath(new URL(trimmed));
  }
  return trimmed;
}

/**
 * Returns the filesystem path segment from a package-manager dependency value, or null if not a local ref.
 */
export function extractFsRef(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("workspace:")) return null;
  if (trimmed.startsWith("catalog:")) return null;
  if (trimmed.startsWith("npm:")) return null;

  if (trimmed.startsWith("file:")) {
    return normalizeFsPathSegment(trimmed.slice("file:".length));
  }
  if (trimmed.startsWith("link:")) {
    return normalizeFsPathSegment(trimmed.slice("link:".length));
  }

  const fileMarker = "@file:";
  const linkMarker = "@link:";
  const fileIdx = trimmed.lastIndexOf(fileMarker);
  if (fileIdx !== -1) {
    return normalizeFsPathSegment(trimmed.slice(fileIdx + fileMarker.length));
  }
  const linkIdx = trimmed.lastIndexOf(linkMarker);
  if (linkIdx !== -1) {
    return normalizeFsPathSegment(trimmed.slice(linkIdx + linkMarker.length));
  }

  return null;
}

export function resolveFsTarget(baseDir: string, fsRef: string): string {
  const normalized = normalizeFsPathSegment(fsRef);
  if (path.isAbsolute(normalized)) {
    return path.resolve(normalized);
  }
  return path.resolve(baseDir, normalized);
}

function recordViolation(
  violations: string[],
  context: string,
  value: string,
): void {
  violations.push(
    `${context}: filesystem dependency resolves outside repository root (${value})`,
  );
}

function inspectDependencyValue(
  root: string,
  baseDir: string,
  context: string,
  value: string,
  violations: string[],
): void {
  const fsRef = extractFsRef(value);
  if (fsRef === null) return;
  const target = resolveFsTarget(baseDir, fsRef);
  if (!isContained(target, root)) {
    recordViolation(violations, context, value);
  }
}

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

function workspacePatternPrefix(pattern: string): string {
  const trimmed = pattern.trim().replace(/^['"]|['"]$/g, "");
  const magic = GLOB_MAGIC.exec(trimmed);
  if (!magic || magic.index === undefined) {
    return trimmed;
  }
  return trimmed.slice(0, magic.index);
}

async function checkPackageJsonManifests(
  root: string,
  violations: string[],
): Promise<void> {
  const packageFiles = await collectPackageJsonFiles(root);

  for (const file of packageFiles) {
    const rel = path.relative(root, file);
    const baseDir = path.dirname(file);
    let pkg: {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    try {
      pkg = JSON.parse(await readFile(file, "utf8")) as typeof pkg;
    } catch {
      violations.push(`${rel}: invalid JSON`);
      continue;
    }

    for (const section of DEPENDENCY_SECTIONS) {
      const deps = pkg[section];
      if (!deps) continue;
      for (const [name, value] of Object.entries(deps)) {
        if (typeof value !== "string") continue;
        inspectDependencyValue(
          root,
          baseDir,
          `${rel}: ${section}.${name}`,
          value,
          violations,
        );
      }
    }
  }
}

function extractFsRefFromPackageKey(key: string): string | null {
  const fileMarker = "@file:";
  const linkMarker = "@link:";
  const fileIdx = key.lastIndexOf(fileMarker);
  if (fileIdx !== -1) {
    return key.slice(fileIdx + fileMarker.length);
  }
  const linkIdx = key.lastIndexOf(linkMarker);
  if (linkIdx !== -1) {
    return key.slice(linkIdx + linkMarker.length);
  }
  return null;
}

function importerProjectDir(root: string, importerKey: string): string {
  if (importerKey === ".") return root;
  return path.resolve(root, importerKey);
}

function walkImporterNode(
  root: string,
  importerBase: string,
  node: unknown,
  context: string,
  violations: string[],
): void {
  if (node === null || node === undefined) return;
  if (typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  if (typeof record.specifier === "string") {
    inspectDependencyValue(
      root,
      importerBase,
      `${context}.specifier`,
      record.specifier,
      violations,
    );
  }
  if (typeof record.version === "string") {
    inspectDependencyValue(
      root,
      importerBase,
      `${context}.version`,
      record.version,
      violations,
    );
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "specifier" || key === "version") continue;
    walkImporterNode(
      root,
      importerBase,
      value,
      `${context}.${key}`,
      violations,
    );
  }
}

async function checkPnpmLockfile(
  root: string,
  violations: string[],
): Promise<void> {
  const lockPath = path.join(root, "pnpm-lock.yaml");
  if (!existsSync(lockPath)) {
    violations.push("pnpm-lock.yaml missing");
    return;
  }

  let doc: unknown;
  try {
    doc = parseYaml(await readFile(lockPath, "utf8"));
  } catch {
    violations.push("pnpm-lock.yaml: failed to parse");
    return;
  }

  const lock = doc as {
    importers?: Record<string, unknown>;
    packages?: Record<
      string,
      { resolution?: { type?: string; directory?: string } }
    >;
  };

  const importers = lock.importers;
  if (importers && typeof importers === "object") {
    for (const [importerKey, importerBody] of Object.entries(importers)) {
      const importerDir = importerProjectDir(root, importerKey);
      if (!isContained(importerDir, root)) {
        violations.push(
          `pnpm-lock.yaml: importer ${importerKey} resolves outside repository root`,
        );
      }
      walkImporterNode(
        root,
        importerDir,
        importerBody,
        `pnpm-lock.yaml importers.${importerKey}`,
        violations,
      );
    }
  }

  const packages = lock.packages;
  if (packages && typeof packages === "object") {
    for (const [pkgKey, pkgBody] of Object.entries(packages)) {
      const fsRef = extractFsRefFromPackageKey(pkgKey);
      if (fsRef !== null) {
        const target = resolveFsTarget(root, fsRef);
        if (!isContained(target, root)) {
          recordViolation(
            violations,
            `pnpm-lock.yaml packages key ${pkgKey}`,
            fsRef,
          );
        }
      }

      const resolution = pkgBody?.resolution;
      if (
        resolution?.type === "directory" &&
        typeof resolution.directory === "string"
      ) {
        const target = resolveFsTarget(root, resolution.directory);
        if (!isContained(target, root)) {
          recordViolation(
            violations,
            `pnpm-lock.yaml packages.${pkgKey}.resolution.directory`,
            resolution.directory,
          );
        }
      }
    }
  }
}

async function checkWorkspaceYamlAsync(
  root: string,
  violations: string[],
): Promise<void> {
  const workspacePath = path.join(root, "pnpm-workspace.yaml");
  if (!existsSync(workspacePath)) {
    return;
  }

  let doc: unknown;
  try {
    doc = parseYaml(await readFile(workspacePath, "utf8"));
  } catch {
    violations.push("pnpm-workspace.yaml: failed to parse");
    return;
  }

  const packages = (doc as { packages?: unknown })?.packages;
  if (!Array.isArray(packages)) {
    return;
  }

  for (let i = 0; i < packages.length; i++) {
    const entry = packages[i];
    if (typeof entry !== "string") continue;
    const prefix = workspacePatternPrefix(entry);
    if (!prefix) {
      violations.push(
        `pnpm-workspace.yaml: packages[${i}] pattern cannot be proven in-repository (${entry})`,
      );
      continue;
    }
    const resolved = path.resolve(root, prefix);
    if (!isContained(resolved, root)) {
      violations.push(
        `pnpm-workspace.yaml: packages[${i}] pattern escapes repository root (${entry})`,
      );
    }
  }
}

/**
 * Returns all self-containment violations under `root`, or an empty array when clean.
 */
export async function checkNoCrossRepoFileLinks(
  root: string = DEFAULT_ROOT,
): Promise<string[]> {
  const violations: string[] = [];
  await checkPackageJsonManifests(root, violations);
  await checkWorkspaceYamlAsync(root, violations);
  await checkPnpmLockfile(root, violations);
  return violations;
}

export async function assertNoCrossRepoFileLinks(
  root: string = DEFAULT_ROOT,
): Promise<void> {
  const violations = await checkNoCrossRepoFileLinks(root);
  if (violations.length > 0) {
    throw new Error(violations.join("\n"));
  }
}

async function main(): Promise<void> {
  const violations = await checkNoCrossRepoFileLinks(DEFAULT_ROOT);
  if (violations.length > 0) {
    console.error("check:no-cross-repo-file-links FAILED:\n");
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log("check:no-cross-repo-file-links OK");
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
