/**
 * Lockfile diff — detects changed packages between base and head lockfiles.
 */

import { logWarn } from "./log.js";

function extractPackages(
  lockfileContent: string,
  manager: "pnpm" | "npm" | "yarn",
): Map<string, string> {
  const packages = new Map<string, string>();

  try {
    if (manager === "pnpm") {
      const lines = lockfileContent.split("\n");
      let inPackages = false;

      for (const line of lines) {
        if (line.startsWith("packages:")) {
          inPackages = true;
          continue;
        }

        if (inPackages && line.startsWith("  ") && line.includes(":")) {
          const match = line.match(
            /^\s+['"]?\/?(@[^@\s/]+\/[^@\s]+|[^@'":\s/]+)@([^'":\s]+)['"]?:/,
          );
          if (match) {
            const [, name, version] = match;
            if (name && version) {
              packages.set(name, version);
            }
          }
        }

        if (inPackages && line.match(/^[a-z]/)) {
          break;
        }
      }
    } else if (manager === "npm") {
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

export function detectChangedPackages(
  baseLockfile: string,
  headLockfile: string,
  manager: "pnpm" | "npm" | "yarn",
): string[] {
  const basePackages = extractPackages(baseLockfile, manager);
  const headPackages = extractPackages(headLockfile, manager);

  const changed = new Set<string>();

  for (const [name, headVersion] of headPackages.entries()) {
    const baseVersion = basePackages.get(name);
    if (!baseVersion) {
      changed.add(name);
    } else if (baseVersion !== headVersion) {
      changed.add(name);
    }
  }

  for (const name of basePackages.keys()) {
    if (!headPackages.has(name)) {
      changed.add(name);
    }
  }

  return Array.from(changed);
}

export function detectLockfilePackageDelta(
  baseLockfile: string,
  headLockfile: string,
  manager: "pnpm" | "npm" | "yarn",
): { added: string[]; removed: string[]; updated: string[] } {
  const basePackages = extractPackages(baseLockfile, manager);
  const headPackages = extractPackages(headLockfile, manager);

  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];

  for (const [name, headVersion] of headPackages.entries()) {
    const baseVersion = basePackages.get(name);
    if (baseVersion === undefined) added.push(name);
    else if (baseVersion !== headVersion) updated.push(name);
  }

  for (const name of basePackages.keys()) {
    if (!headPackages.has(name)) removed.push(name);
  }

  added.sort();
  removed.sort();
  updated.sort();
  return { added, removed, updated };
}
