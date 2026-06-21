/**
 * Lockfile diff — detects changed packages between base and head lockfiles.
 */

import type { LockfilePackageDelta } from "@mergesignal/shared";

import { logWarn } from "./log.js";

type LockfileDiffOptions = {
  changedPackageJsonFiles?: string[];
};

type ImporterDep = {
  specifier: string;
  version: string;
};

const PNPM_PACKAGE_KEY_RE =
  /^\s+['"]?\/?(@[^@\s/]+\/[^@\s]+|[^@'":\s/]+)@([^'":\s]+)['"]?:/;

const PNPM_IMPORTER_DEP_SECTIONS = new Set([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
]);

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

function sortDelta(delta: LockfilePackageDelta): LockfilePackageDelta {
  return {
    added: [...delta.added].sort(),
    removed: [...delta.removed].sort(),
    updated: [...delta.updated].sort(),
  };
}

function deltaFromChangedNames(delta: LockfilePackageDelta): string[] {
  const changed = new Set<string>([
    ...delta.added,
    ...delta.removed,
    ...delta.updated,
  ]);
  return Array.from(changed).sort();
}

function diffImporterDeps(
  base: Map<string, ImporterDep>,
  head: Map<string, ImporterDep>,
): LockfilePackageDelta {
  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];

  for (const [name, headDep] of head.entries()) {
    const baseDep = base.get(name);
    if (!baseDep) {
      added.push(name);
    } else if (
      baseDep.version !== headDep.version ||
      baseDep.specifier !== headDep.specifier
    ) {
      updated.push(name);
    }
  }

  for (const name of base.keys()) {
    if (!head.has(name)) removed.push(name);
  }

  return sortDelta({ added, removed, updated });
}

function diffPackageVersionSets(
  base: Map<string, Set<string>>,
  head: Map<string, Set<string>>,
): LockfilePackageDelta {
  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];

  for (const [name, headVersions] of head.entries()) {
    const baseVersions = base.get(name);
    if (!baseVersions) {
      added.push(name);
    } else if (!setsEqual(baseVersions, headVersions)) {
      updated.push(name);
    }
  }

  for (const name of base.keys()) {
    if (!head.has(name)) removed.push(name);
  }

  return sortDelta({ added, removed, updated });
}

function normalizePnpmPackageName(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Per-importer direct deps: importer key → package name → dep entry. */
function extractPnpmImporterSections(
  lockfileContent: string,
): Map<string, Map<string, ImporterDep>> {
  const importers = new Map<string, Map<string, ImporterDep>>();

  try {
    const lines = lockfileContent.split("\n");
    let inImporters = false;
    let currentImporter: string | null = null;
    let inDepSection = false;
    let currentName: string | null = null;
    let current: ImporterDep | null = null;

    const importerDeps = (): Map<string, ImporterDep> => {
      if (!currentImporter) return new Map();
      let deps = importers.get(currentImporter);
      if (!deps) {
        deps = new Map();
        importers.set(currentImporter, deps);
      }
      return deps;
    };

    const flush = () => {
      if (currentImporter && currentName && current) {
        importerDeps().set(currentName, current);
      }
      currentName = null;
      current = null;
    };

    for (const line of lines) {
      if (line.startsWith("importers:")) {
        inImporters = true;
        continue;
      }

      if (!inImporters) continue;

      if (line.match(/^[^\s]/)) {
        break;
      }

      const importerMatch = line.match(/^  ([^\s][^:]*):$/);
      if (importerMatch?.[1]) {
        flush();
        currentImporter = importerMatch[1];
        inDepSection = false;
        continue;
      }

      const sectionMatch = line.match(/^    ([^:]+):$/);
      if (
        sectionMatch?.[1] &&
        PNPM_IMPORTER_DEP_SECTIONS.has(sectionMatch[1])
      ) {
        flush();
        inDepSection = true;
        continue;
      }

      if (!inDepSection) continue;

      const pkgMatch = line.match(/^      ([^:]+):$/);
      if (pkgMatch?.[1]) {
        flush();
        currentName = normalizePnpmPackageName(pkgMatch[1]);
        current = { specifier: "", version: "" };
        continue;
      }

      if (!current) continue;

      const specMatch = line.match(/^\s+specifier:\s*(.+)$/);
      if (specMatch?.[1]) {
        current.specifier = specMatch[1].trim();
        continue;
      }

      const versionMatch = line.match(/^\s+version:\s*(.+)$/);
      if (versionMatch?.[1]) {
        current.version = versionMatch[1].trim();
      }
    }

    flush();
  } catch (error) {
    logWarn(
      {
        error: error instanceof Error ? error.message : String(error),
        manager: "pnpm",
        section: "importers",
      },
      "Failed to parse pnpm importer section",
    );
  }

  return importers;
}

/** PNPM importer key → package.json path (`.` is workspace root). */
export function importerManifestPath(importerKey: string): string {
  return importerKey === "." ? "package.json" : `${importerKey}/package.json`;
}

function resolveTouchedImporterKeys(
  importerKeys: Iterable<string>,
  changedPackageJsonFiles: string[],
): Set<string> {
  const touchedManifests = new Set(changedPackageJsonFiles);
  const touched = new Set<string>();
  for (const importerKey of importerKeys) {
    if (touchedManifests.has(importerManifestPath(importerKey))) {
      touched.add(importerKey);
    }
  }
  return touched;
}

function unionImporterDeltas(
  baseLockfile: string,
  headLockfile: string,
  options?: LockfileDiffOptions,
): LockfilePackageDelta {
  const baseSections = extractPnpmImporterSections(baseLockfile);
  const headSections = extractPnpmImporterSections(headLockfile);
  const allImporterKeys = new Set([
    ...baseSections.keys(),
    ...headSections.keys(),
  ]);

  const perImporterDelta = new Map<string, LockfilePackageDelta>();
  for (const importerKey of allImporterKeys) {
    perImporterDelta.set(
      importerKey,
      diffImporterDeps(
        baseSections.get(importerKey) ?? new Map(),
        headSections.get(importerKey) ?? new Map(),
      ),
    );
  }

  const useManifestFilter =
    options?.changedPackageJsonFiles &&
    options.changedPackageJsonFiles.length > 0;

  const touchedImporterKeys = useManifestFilter
    ? resolveTouchedImporterKeys(
        allImporterKeys,
        options.changedPackageJsonFiles!,
      )
    : allImporterKeys;

  const driftPackages = new Set<string>();
  if (useManifestFilter) {
    // Packages that change only on untouched importers are branch-skew drift.
    for (const importerKey of allImporterKeys) {
      if (touchedImporterKeys.has(importerKey)) continue;
      const delta = perImporterDelta.get(importerKey)!;
      for (const name of delta.added) driftPackages.add(name);
      for (const name of delta.removed) driftPackages.add(name);
      for (const name of delta.updated) driftPackages.add(name);
    }
  }

  const added = new Set<string>();
  const removed = new Set<string>();
  const updated = new Set<string>();

  for (const importerKey of touchedImporterKeys) {
    const delta = perImporterDelta.get(importerKey)!;
    for (const name of delta.added) added.add(name);
    for (const name of delta.updated) updated.add(name);
    for (const name of delta.removed) {
      // Suppress removals that also appear on untouched importers (cross-workspace drift).
      if (!driftPackages.has(name)) removed.add(name);
    }
  }

  return sortDelta({
    added: [...added],
    removed: [...removed],
    updated: [...updated],
  });
}

function extractPnpmPackageVersions(
  lockfileContent: string,
): Map<string, Set<string>> {
  const packages = new Map<string, Set<string>>();

  try {
    const lines = lockfileContent.split("\n");
    let inPackages = false;

    for (const line of lines) {
      if (line.startsWith("packages:")) {
        inPackages = true;
        continue;
      }

      if (inPackages && line.startsWith("  ") && line.includes(":")) {
        const match = line.match(PNPM_PACKAGE_KEY_RE);
        if (match) {
          const [, name, version] = match;
          if (name && version) {
            let versions = packages.get(name);
            if (!versions) {
              versions = new Set<string>();
              packages.set(name, versions);
            }
            versions.add(version);
          }
        }
      }

      if (inPackages && line.match(/^[a-z]/)) {
        break;
      }
    }
  } catch (error) {
    logWarn(
      {
        error: error instanceof Error ? error.message : String(error),
        manager: "pnpm",
        section: "packages",
      },
      "Failed to parse pnpm packages section",
    );
  }

  return packages;
}

function extractPackages(
  lockfileContent: string,
  manager: "pnpm" | "npm" | "yarn",
): Map<string, string> {
  const packages = new Map<string, string>();

  try {
    if (manager === "npm") {
      const parsed = JSON.parse(lockfileContent) as {
        packages?: Record<string, { version?: string }>;
        dependencies?: Record<string, { version?: string }>;
      };
      const pkgs = parsed.packages ?? parsed.dependencies ?? {};

      for (const [path, info] of Object.entries(pkgs)) {
        if (path === "") continue;
        const name = path.replace(/^node_modules\//, "");
        const version = info?.version;
        if (name && typeof version === "string") {
          packages.set(name, version);
        }
      }
    } else if (manager === "yarn") {
      const lines = lockfileContent.split("\n");
      let currentPackage: string | null = null;

      for (const line of lines) {
        if (line.match(/^"?[^"\s]+@[^"\s]+"?:/)) {
          const match = line.match(/^"?([^@\s]+)@[^"\s]+"?:/);
          if (match) {
            currentPackage = match[1] ?? null;
          }
        } else if (currentPackage && line.match(/^\s+version\s+"([^"]+)"/)) {
          const versionMatch = line.match(/^\s+version\s+"([^"]+)"/);
          if (versionMatch?.[1]) {
            packages.set(currentPackage, versionMatch[1]);
            currentPackage = null;
          }
        }
      }
    }
  } catch (error) {
    logWarn(
      {
        error: error instanceof Error ? error.message : String(error),
        manager,
      },
      "Failed to parse lockfile",
    );
  }

  return packages;
}

function diffFlatPackages(
  base: Map<string, string>,
  head: Map<string, string>,
): LockfilePackageDelta {
  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];

  for (const [name, headVersion] of head.entries()) {
    const baseVersion = base.get(name);
    if (baseVersion === undefined) added.push(name);
    else if (baseVersion !== headVersion) updated.push(name);
  }

  for (const name of base.keys()) {
    if (!head.has(name)) removed.push(name);
  }

  return sortDelta({ added, removed, updated });
}

function pnpmLockfileHasImporters(lockfileContent: string): boolean {
  return lockfileContent.includes("importers:");
}

/** PR-facing delta: importer-direct changes when importers exist; else packages section. */
function resolvePnpmPrFacingDelta(
  importerDelta: LockfilePackageDelta,
  packagesDelta: LockfilePackageDelta,
  baseLockfile: string,
  headLockfile: string,
): LockfilePackageDelta {
  if (
    pnpmLockfileHasImporters(baseLockfile) &&
    pnpmLockfileHasImporters(headLockfile)
  ) {
    return importerDelta;
  }
  return packagesDelta;
}

function detectPnpmLockfileDiffChannels(
  baseLockfile: string,
  headLockfile: string,
  options?: LockfileDiffOptions,
): {
  merged: LockfilePackageDelta;
  importerDelta: LockfilePackageDelta;
  packagesDelta: LockfilePackageDelta;
} {
  const importerDelta = unionImporterDeltas(
    baseLockfile,
    headLockfile,
    options,
  );
  const packagesDelta = diffPackageVersionSets(
    extractPnpmPackageVersions(baseLockfile),
    extractPnpmPackageVersions(headLockfile),
  );
  const merged = resolvePnpmPrFacingDelta(
    importerDelta,
    packagesDelta,
    baseLockfile,
    headLockfile,
  );
  return { merged, importerDelta, packagesDelta };
}

export function isPnpmLockfileDiffEmpty(
  baseLockfile: string,
  headLockfile: string,
  options?: LockfileDiffOptions,
): boolean {
  const { merged } = detectPnpmLockfileDiffChannels(
    baseLockfile,
    headLockfile,
    options,
  );
  return (
    merged.added.length === 0 &&
    merged.removed.length === 0 &&
    merged.updated.length === 0
  );
}

export function detectChangedPackages(
  baseLockfile: string,
  headLockfile: string,
  manager: "pnpm" | "npm" | "yarn",
  options?: LockfileDiffOptions,
): string[] {
  if (manager === "pnpm") {
    const { merged } = detectPnpmLockfileDiffChannels(
      baseLockfile,
      headLockfile,
      options,
    );
    return deltaFromChangedNames(merged);
  }

  const basePackages = extractPackages(baseLockfile, manager);
  const headPackages = extractPackages(headLockfile, manager);
  return deltaFromChangedNames(diffFlatPackages(basePackages, headPackages));
}

export function detectLockfilePackageDelta(
  baseLockfile: string,
  headLockfile: string,
  manager: "pnpm" | "npm" | "yarn",
  options?: LockfileDiffOptions,
): LockfilePackageDelta {
  if (manager === "pnpm") {
    return detectPnpmLockfileDiffChannels(baseLockfile, headLockfile, options)
      .merged;
  }

  const basePackages = extractPackages(baseLockfile, manager);
  const headPackages = extractPackages(headLockfile, manager);
  return diffFlatPackages(basePackages, headPackages);
}
