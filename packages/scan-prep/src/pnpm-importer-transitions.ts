import type { LockfileDiffOptions } from "./lockfile-diff.js";
import { normalizePnpmResolvedVersion } from "./lockfile-diff.js";

export type ImporterTransitionChangeKind =
  | "added"
  | "removed"
  | "version_update"
  | "specifier_only";

export type PnpmImporterTransitionFact = {
  readonly importerKey: string;
  readonly packageName: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly changeKind: ImporterTransitionChangeKind;
};

export type CollapsedPackageTransition = {
  readonly kind: "added" | "removed" | "version_update";
  readonly fromVersion: string;
  readonly toVersion: string;
};

export type PnpmPackageTransitionCollapse =
  | {
      readonly status: "collapsed";
      readonly transition: CollapsedPackageTransition;
    }
  | {
      readonly status: "ambiguous";
      readonly facts: readonly PnpmImporterTransitionFact[];
    }
  | {
      readonly status: "specifier_only";
      readonly facts: readonly PnpmImporterTransitionFact[];
    }
  | { readonly status: "none" };

type ImporterDep = {
  specifier: string;
  version: string;
};

const PNPM_IMPORTER_DEP_SECTIONS = new Set([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
]);

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

      const importerMatch = line.match(/^ {2}([^\s][^:]*):$/);
      if (importerMatch?.[1]) {
        flush();
        currentImporter = importerMatch[1];
        inDepSection = false;
        continue;
      }

      const sectionMatch = line.match(/^ {4}([^:]+):$/);
      if (
        sectionMatch?.[1] &&
        PNPM_IMPORTER_DEP_SECTIONS.has(sectionMatch[1])
      ) {
        flush();
        inDepSection = true;
        continue;
      }

      if (!inDepSection) continue;

      const pkgMatch = line.match(/^ {6}([^:]+):$/);
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
  } catch {
    return importers;
  }

  return importers;
}

function importerManifestPath(importerKey: string): string {
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

function factForImporter(input: {
  importerKey: string;
  packageName: string;
  baseDep?: ImporterDep;
  headDep?: ImporterDep;
}): PnpmImporterTransitionFact | undefined {
  const { importerKey, packageName, baseDep, headDep } = input;

  if (!headDep && baseDep) {
    return {
      importerKey,
      packageName,
      fromVersion: normalizePnpmResolvedVersion(baseDep.version),
      toVersion: "0.0.0",
      changeKind: "removed",
    };
  }

  if (headDep && !baseDep) {
    return {
      importerKey,
      packageName,
      fromVersion: "0.0.0",
      toVersion: normalizePnpmResolvedVersion(headDep.version),
      changeKind: "added",
    };
  }

  if (!headDep || !baseDep) return undefined;

  const fromVersion = normalizePnpmResolvedVersion(baseDep.version);
  const toVersion = normalizePnpmResolvedVersion(headDep.version);
  const specifierChanged = baseDep.specifier !== headDep.specifier;
  const versionChanged = fromVersion !== toVersion;

  if (!specifierChanged && !versionChanged) {
    return undefined;
  }

  if (versionChanged) {
    return {
      importerKey,
      packageName,
      fromVersion,
      toVersion,
      changeKind: "version_update",
    };
  }

  return {
    importerKey,
    packageName,
    fromVersion,
    toVersion,
    changeKind: "specifier_only",
  };
}

/**
 * Collect importer-scoped transition facts for one package across touched workspace importers.
 * Uses the same manifest filter as lockfile diff authority.
 */
export function collectPnpmImporterTransitionFacts(input: {
  packageName: string;
  baseLockfile: string;
  headLockfile: string;
  options?: LockfileDiffOptions;
}): PnpmImporterTransitionFact[] {
  const { packageName, baseLockfile, headLockfile, options } = input;
  const baseSections = extractPnpmImporterSections(baseLockfile);
  const headSections = extractPnpmImporterSections(headLockfile);
  const allImporterKeys = new Set([
    ...baseSections.keys(),
    ...headSections.keys(),
  ]);

  const useManifestFilter =
    options?.changedPackageJsonFiles &&
    options.changedPackageJsonFiles.length > 0;
  const touchedImporterKeys = useManifestFilter
    ? resolveTouchedImporterKeys(
        allImporterKeys,
        options.changedPackageJsonFiles!,
      )
    : allImporterKeys;

  const facts: PnpmImporterTransitionFact[] = [];
  for (const importerKey of [...touchedImporterKeys].sort((a, b) =>
    a.localeCompare(b),
  )) {
    const fact = factForImporter({
      importerKey,
      packageName,
      baseDep: baseSections.get(importerKey)?.get(packageName),
      headDep: headSections.get(importerKey)?.get(packageName),
    });
    if (fact) facts.push(fact);
  }

  return facts;
}

function transitionPairKey(fromVersion: string, toVersion: string): string {
  return `${fromVersion}->${toVersion}`;
}

/**
 * Collapse importer facts into one package-level transition or explicit ambiguity.
 * Never selects an arbitrary importer — conflicting version pairs become ambiguous.
 */
export function collapsePnpmImporterTransitions(
  facts: readonly PnpmImporterTransitionFact[],
): PnpmPackageTransitionCollapse {
  if (facts.length === 0) {
    return { status: "none" };
  }

  const versionFacts = facts.filter(
    (fact) => fact.changeKind === "version_update",
  );
  const addedFacts = facts.filter((fact) => fact.changeKind === "added");
  const removedFacts = facts.filter((fact) => fact.changeKind === "removed");
  const specifierFacts = facts.filter(
    (fact) => fact.changeKind === "specifier_only",
  );

  const versionPairs = new Set(
    versionFacts.map((fact) =>
      transitionPairKey(fact.fromVersion, fact.toVersion),
    ),
  );
  const addedTargets = new Set(addedFacts.map((fact) => fact.toVersion));
  const removedSources = new Set(removedFacts.map((fact) => fact.fromVersion));

  const hasStructuralConflict =
    (addedFacts.length > 0 &&
      (versionFacts.length > 0 || removedFacts.length > 0)) ||
    (removedFacts.length > 0 &&
      (versionFacts.length > 0 || addedFacts.length > 0)) ||
    versionPairs.size > 1 ||
    (addedFacts.length > 0 && addedTargets.size > 1) ||
    (removedFacts.length > 0 && removedSources.size > 1);

  if (hasStructuralConflict) {
    return { status: "ambiguous", facts: [...facts] };
  }

  if (versionFacts.length > 0) {
    const sample = versionFacts[0]!;
    return {
      status: "collapsed",
      transition: {
        kind: "version_update",
        fromVersion: sample.fromVersion,
        toVersion: sample.toVersion,
      },
    };
  }

  if (addedFacts.length === 1 && addedFacts[0]) {
    return {
      status: "collapsed",
      transition: {
        kind: "added",
        fromVersion: "0.0.0",
        toVersion: addedFacts[0].toVersion,
      },
    };
  }

  if (addedFacts.length > 1) {
    return { status: "ambiguous", facts: [...facts] };
  }

  if (removedFacts.length === 1 && removedFacts[0]) {
    return {
      status: "collapsed",
      transition: {
        kind: "removed",
        fromVersion: removedFacts[0].fromVersion,
        toVersion: "0.0.0",
      },
    };
  }

  if (removedFacts.length > 1) {
    return { status: "ambiguous", facts: [...facts] };
  }

  if (specifierFacts.length > 0) {
    return { status: "specifier_only", facts: [...specifierFacts] };
  }

  return { status: "none" };
}

/**
 * Collect and collapse workspace importer transitions for one package.
 */
export function resolvePnpmPackageTransitionCollapse(input: {
  packageName: string;
  baseLockfile: string;
  headLockfile: string;
  options?: LockfileDiffOptions;
}): PnpmPackageTransitionCollapse & {
  facts: readonly PnpmImporterTransitionFact[];
} {
  const facts = collectPnpmImporterTransitionFacts(input);
  const collapsed = collapsePnpmImporterTransitions(facts);
  return { ...collapsed, facts };
}
