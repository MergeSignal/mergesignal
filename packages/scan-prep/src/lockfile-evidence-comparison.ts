/**
 * Lockfile parse completeness and verified comparison for Scan Preparation evidence.
 * Internal parse reports are not part of the public API.
 */

import type {
  LockfileEvidenceStatus,
  LockfilePackageDelta,
} from "@mergesignal/shared";

import {
  detectLockfilePackageDelta,
  type LockfileDiffOptions,
} from "./lockfile-diff.js";

const PNPM_PACKAGE_KEY_RE =
  /^\s+['"]?\/?(@[^@\s/]+\/[^@\s]+|[^@'":\s/]+)@([^'":\s]+)['"]?:/;

const PNPM_IMPORTER_DEP_SECTIONS = new Set([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
]);

type ParseReport = {
  complete: boolean;
};

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

function pnpmLockfileHasImporters(lockfileContent: string): boolean {
  return lockfileContent.includes("importers:");
}

function activePnpmChannel(
  baseLockfile: string,
  headLockfile: string,
): "importers" | "packages" {
  if (
    pnpmLockfileHasImporters(baseLockfile) &&
    pnpmLockfileHasImporters(headLockfile)
  ) {
    return "importers";
  }
  return "packages";
}

function assessPnpmImporterSection(content: string): ParseReport {
  let complete = true;
  try {
    const lines = content.split("\n");
    let inImporters = false;
    let inDepSection = false;
    let currentName: string | null = null;
    let currentVersion = "";
    let currentSpecifier = "";

    const entryIncomplete = (): boolean =>
      currentName !== null &&
      (currentVersion.trim() === "" || currentSpecifier.trim() === "");

    for (const line of lines) {
      if (line.startsWith("importers:")) {
        inImporters = true;
        continue;
      }
      if (!inImporters) continue;

      if (line.match(/^[^\s]/)) break;

      const sectionMatch = line.match(/^ {4}([^:]+):$/);
      if (
        sectionMatch?.[1] &&
        PNPM_IMPORTER_DEP_SECTIONS.has(sectionMatch[1])
      ) {
        if (entryIncomplete()) complete = false;
        currentName = null;
        currentVersion = "";
        currentSpecifier = "";
        inDepSection = true;
        continue;
      }

      if (!inDepSection) continue;

      const pkgMatch = line.match(/^ {6}([^:]+):$/);
      if (pkgMatch?.[1]) {
        if (entryIncomplete()) complete = false;
        currentName = normalizePnpmPackageName(pkgMatch[1]);
        currentVersion = "";
        currentSpecifier = "";
        continue;
      }

      if (!currentName) continue;

      const specMatch = line.match(/^\s+specifier:\s*(.+)$/);
      if (specMatch?.[1]) {
        currentSpecifier = specMatch[1].trim();
        continue;
      }

      const versionMatch = line.match(/^\s+version:\s*(.+)$/);
      if (versionMatch?.[1]) {
        currentVersion = versionMatch[1].trim();
      }
    }

    if (entryIncomplete()) complete = false;
  } catch {
    complete = false;
  }

  return { complete };
}

function assessPnpmPackagesSection(content: string): ParseReport {
  let complete = true;
  try {
    const lines = content.split("\n");
    let inPackages = false;
    let sawPackagesHeader = false;

    for (const line of lines) {
      if (line.startsWith("packages:")) {
        inPackages = true;
        sawPackagesHeader = true;
        continue;
      }
      if (!inPackages) continue;
      if (line.match(/^[a-z]/)) break;

      if (line.startsWith("  ") && line.includes(":")) {
        const match = line.match(PNPM_PACKAGE_KEY_RE);
        if (!match && line.trim().length > 0 && !line.match(/^\s+\w+:/)) {
          complete = false;
        }
      }
    }

    if (
      !sawPackagesHeader &&
      content.trim().length > 0 &&
      content.includes("lockfileVersion")
    ) {
      // pnpm lockfile without packages section can be valid when importers-only
      return { complete: true };
    }
  } catch {
    complete = false;
  }

  return { complete };
}

function assessNpmLockfile(content: string): ParseReport {
  try {
    const parsed: unknown = JSON.parse(content);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { complete: false };
    }
    const record = parsed as Record<string, unknown>;
    const packages = record.packages;
    const dependencies = record.dependencies;
    if (
      packages !== undefined &&
      (typeof packages !== "object" ||
        packages === null ||
        Array.isArray(packages))
    ) {
      return { complete: false };
    }
    if (
      dependencies !== undefined &&
      (typeof dependencies !== "object" ||
        dependencies === null ||
        Array.isArray(dependencies))
    ) {
      return { complete: false };
    }

    const hasLockfileVersion =
      typeof record.lockfileVersion === "number" ||
      typeof record.lockfileVersion === "string";
    const hasPackages = packages !== undefined;
    const hasDependencies = dependencies !== undefined;

    if (!hasLockfileVersion && !hasPackages && !hasDependencies) {
      return { complete: false };
    }

    if (hasLockfileVersion && !hasPackages && !hasDependencies) {
      return { complete: true };
    }

    if (!hasLockfileVersion && hasDependencies) {
      return { complete: true };
    }

    if (hasLockfileVersion && (hasPackages || hasDependencies)) {
      return { complete: true };
    }

    return { complete: false };
  } catch {
    return { complete: false };
  }
}

function assessYarnLockfile(content: string): ParseReport {
  const trimmed = content.trim();
  if (trimmed.length === 0) return { complete: true };

  const lines = content.split("\n");
  let currentPackage: string | null = null;
  let recognizedEntries = 0;

  for (const line of lines) {
    if (line.trim().startsWith("#")) continue;

    if (line.match(/^"[^"]+":\s*$/)) {
      if (currentPackage !== null) return { complete: false };
      currentPackage = "pending";
      continue;
    }
    if (currentPackage && line.match(/^\s+version\s+"([^"]+)"/)) {
      recognizedEntries += 1;
      currentPackage = null;
    }
  }

  if (currentPackage !== null) return { complete: false };
  if (recognizedEntries === 0 && trimmed.length > 0) return { complete: false };
  return { complete: true };
}

function assessSideCompleteness(
  content: string,
  manager: "pnpm" | "npm" | "yarn",
  channel: "importers" | "packages" | "flat",
): ParseReport {
  if (manager === "npm") return assessNpmLockfile(content);
  if (manager === "yarn") return assessYarnLockfile(content);
  if (channel === "importers") return assessPnpmImporterSection(content);
  return assessPnpmPackagesSection(content);
}

function isDeltaEmpty(delta: LockfilePackageDelta): boolean {
  return (
    delta.added.length === 0 &&
    delta.removed.length === 0 &&
    delta.updated.length === 0
  );
}

type LockfileComparisonResult = {
  evidenceStatus: LockfileEvidenceStatus;
  changedPackages: string[];
  lockfilePackageDelta?: LockfilePackageDelta;
};

export function compareLockfileEvidence(input: {
  baseContent: string;
  headContent: string;
  manager: "pnpm" | "npm" | "yarn";
  options?: LockfileDiffOptions;
}): LockfileComparisonResult {
  const channel =
    input.manager === "pnpm"
      ? activePnpmChannel(input.baseContent, input.headContent)
      : "flat";

  const baseReport = assessSideCompleteness(
    input.baseContent,
    input.manager,
    channel,
  );
  const headReport = assessSideCompleteness(
    input.headContent,
    input.manager,
    channel,
  );

  if (!baseReport.complete || !headReport.complete) {
    return {
      evidenceStatus: { kind: "unavailable", reason: "incomplete_parse" },
      changedPackages: [],
    };
  }

  const delta = detectLockfilePackageDelta(
    input.baseContent,
    input.headContent,
    input.manager,
    input.options,
  );

  if (isDeltaEmpty(delta)) {
    return {
      evidenceStatus: { kind: "verified", delta: "empty" },
      changedPackages: [],
      lockfilePackageDelta: delta,
    };
  }

  const changed = [
    ...new Set([...delta.added, ...delta.removed, ...delta.updated]),
  ].sort();

  return {
    evidenceStatus: { kind: "verified", delta: "changed" },
    changedPackages: changed,
    lockfilePackageDelta: delta,
  };
}

/** Whether a comparable base/head lockfile pair is present on the job. */
export function lockfileComparisonExpected(input: {
  lockfile?: unknown;
  baseLockfile?: unknown;
  github?: unknown;
}): boolean {
  if (input.lockfile && input.baseLockfile) return true;
  if (input.github && (input.lockfile || input.baseLockfile)) return true;
  return false;
}
