/**
 * Authoritative Shared release version reader for CI governance.
 * Owns: packages/shared/package.json → version
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED_PACKAGE_JSON = path.resolve(
  __dirname,
  "../../../packages/shared/package.json",
);
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export function readSharedReleaseVersion(): string {
  let raw: string;
  try {
    raw = readFileSync(SHARED_PACKAGE_JSON, "utf8");
  } catch {
    throw new Error(
      `unable to read Shared release manifest: ${SHARED_PACKAGE_JSON}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `invalid JSON in Shared release manifest: ${SHARED_PACKAGE_JSON}`,
    );
  }

  const version = (parsed as { version?: unknown }).version;
  if (typeof version !== "string" || !version.trim()) {
    throw new Error(
      `missing version in Shared release manifest: ${SHARED_PACKAGE_JSON}`,
    );
  }
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(
      `invalid Shared release version "${version}" in ${SHARED_PACKAGE_JSON}`,
    );
  }

  return version;
}
