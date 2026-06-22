#!/usr/bin/env tsx
/**
 * CI guard: pnpm version has exactly one authority (root package.json packageManager).
 * All Docker, CI, and shell paths must derive via `corepack install` — no hardcoded pnpm@ versions.
 */
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const AUTHORITY_FILE = path.join(ROOT, "package.json");

const PACKAGE_MANAGER_RE =
  /^pnpm@(\d+\.\d+\.\d+)\+sha512\.[A-Za-z0-9+/]+=*$/;

const SCAN_ROOTS = [
  path.join(ROOT, "apps"),
  path.join(ROOT, "scripts"),
  path.join(ROOT, ".github"),
  path.join(ROOT, "docs"),
];

const SCAN_EXTENSIONS = new Set([
  ".yml",
  ".yaml",
  ".sh",
  ".Dockerfile",
  ".md",
]);

const FORBIDDEN_PATTERNS: Array<{ name: string; re: RegExp }> = [
  {
    name: "corepack prepare pnpm@",
    re: /corepack\s+prepare\s+pnpm@\d/i,
  },
  {
    name: "pnpm/action-setup version pin",
    re: /pnpm\/action-setup[\s\S]{0,200}?\n\s+version:\s*['"]?\d/i,
  },
  {
    name: "hardcoded pnpm semver in RUN/CMD",
    re: /pnpm@\d+\.\d+\.\d+/,
  },
];

type Authority = {
  version: string;
  hasIntegrity: boolean;
  raw: string;
};

async function collectFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }
    const ext = path.extname(entry.name);
    const base = entry.name;
    if (
      SCAN_EXTENSIONS.has(ext) ||
      base === "Dockerfile" ||
      base.endsWith("Dockerfile")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseAuthority(raw: string): Authority | null {
  const match = PACKAGE_MANAGER_RE.exec(raw.trim());
  if (!match) return null;
  return {
    version: match[1]!,
    hasIntegrity: true,
    raw: raw.trim(),
  };
}

function parseJson<T>(content: string, label: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`Failed to parse ${label}`);
  }
}

async function readAuthority(violations: string[]): Promise<Authority | null> {
  if (!existsSync(AUTHORITY_FILE)) {
    violations.push("root package.json is missing — required pnpm authority");
    return null;
  }
  const pkg = parseJson<{ packageManager?: string }>(
    await readFile(AUTHORITY_FILE, "utf8"),
    AUTHORITY_FILE,
  );
  if (!pkg.packageManager) {
    violations.push("root package.json must declare packageManager (pnpm authority)");
    return null;
  }
  const authority = parseAuthority(pkg.packageManager);
  if (!authority) {
    violations.push(
      `root package.json packageManager must match pnpm@X.Y.Z+sha512-<hash> (got "${pkg.packageManager}")`,
    );
    return null;
  }
  if (!authority.hasIntegrity) {
    violations.push(
      "root package.json packageManager must include a Corepack integrity hash (+sha512....)",
    );
  }
  return authority;
}

async function checkNoSecondaryPackageManager(
  violations: string[],
): Promise<void> {
  for (const scope of ["apps", "packages"] as const) {
    const scopeDir = path.join(ROOT, scope);
    if (!existsSync(scopeDir)) continue;
    const entries = await readdir(scopeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const file = path.join(scopeDir, entry.name, "package.json");
      if (!existsSync(file)) continue;
      const pkg = parseJson<{ packageManager?: string }>(
        await readFile(file, "utf8"),
        file,
      );
      if (pkg.packageManager) {
        violations.push(
          `${path.relative(ROOT, file)} must not declare packageManager — root package.json is the sole pnpm authority`,
        );
      }
    }
  }
}

async function scanForForbiddenPins(
  violations: string[],
  authority: Authority,
): Promise<void> {
  const files = (
    await Promise.all(SCAN_ROOTS.map((dir) => collectFiles(dir)))
  ).flat();

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    if (rel === "scripts/check-pnpm-version-governance.ts") {
      continue;
    }
    const content = await readFile(file, "utf8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const { name, re } of FORBIDDEN_PATTERNS) {
        if (!re.test(line)) continue;
        if (name === "hardcoded pnpm semver in RUN/CMD") {
          const versionMatch = line.match(/pnpm@(\d+\.\d+\.\d+)/);
          if (versionMatch && versionMatch[1] === authority.version) {
            continue;
          }
        }
        violations.push(
          `${rel}:${i + 1} forbidden ${name} — derive pnpm via corepack install from root package.json (authority: ${authority.raw})`,
        );
        break;
      }
    }

    if (file.endsWith("Dockerfile") || path.basename(file) === "Dockerfile") {
      if (!content.includes("corepack install")) {
        violations.push(
          `${rel} must run "corepack install" after copying root package.json (derives pnpm from packageManager)`,
        );
      }
    }
  }
}

async function checkCiUsesCorepack(violations: string[]): Promise<void> {
  const workflowDir = path.join(ROOT, ".github/workflows");
  if (!existsSync(workflowDir)) return;
  const workflows = await readdir(workflowDir);
  for (const name of workflows) {
    if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
    const file = path.join(workflowDir, name);
    const content = await readFile(file, "utf8");
    if (!content.includes("pnpm install") && !content.includes("pnpm ")) {
      continue;
    }
    if (content.includes("pnpm/action-setup")) {
      violations.push(
        `.github/workflows/${name} must not use pnpm/action-setup — use corepack install from root package.json`,
      );
    }
    if (
      content.includes("pnpm install") &&
      !content.includes("corepack install")
    ) {
      violations.push(
        `.github/workflows/${name} runs pnpm but does not call corepack install`,
      );
    }
  }
}

async function main(): Promise<void> {
  const violations: string[] = [];
  const authority = await readAuthority(violations);
  await checkNoSecondaryPackageManager(violations);
  if (authority) {
    await scanForForbiddenPins(violations, authority);
  }
  await checkCiUsesCorepack(violations);

  if (violations.length > 0) {
    console.error("check:pnpm-governance FAILED:\n");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    console.error(
      "\nSee docs/engineering/pnpm-version-governance.md for the update procedure.",
    );
    process.exit(1);
  }

  console.log(
    `check:pnpm-governance OK (authority: ${authority?.raw ?? "unknown"})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
