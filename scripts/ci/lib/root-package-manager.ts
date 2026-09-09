/**
 * Root monorepo packageManager authority for isolated consumer smoke installs.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PACKAGE_JSON = path.resolve(__dirname, "../../../package.json");
const PACKAGE_MANAGER_RE = /^pnpm@\d+\.\d+\.\d+\+sha512\.[A-Za-z0-9+/]+=*$/;

export function readRootPackageManagerAuthority(): string {
  let raw: string;
  try {
    raw = readFileSync(ROOT_PACKAGE_JSON, "utf8");
  } catch {
    throw new Error(`unable to read root package.json: ${ROOT_PACKAGE_JSON}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`invalid JSON in root package.json: ${ROOT_PACKAGE_JSON}`);
  }

  const packageManager = (parsed as { packageManager?: unknown })
    .packageManager;
  if (typeof packageManager !== "string" || !packageManager.trim()) {
    throw new Error(
      "root package.json must declare packageManager (pnpm authority)",
    );
  }
  if (!PACKAGE_MANAGER_RE.test(packageManager.trim())) {
    throw new Error(
      `root package.json packageManager must match pnpm@X.Y.Z+sha512-<hash> (got "${packageManager}")`,
    );
  }

  return packageManager.trim();
}
