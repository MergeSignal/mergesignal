/**
 * Evidence-honest npmjs version availability checks for @mergesignal/scan-prep.
 */
import { execFileSync } from "node:child_process";

import { NPMJS_REGISTRY, PACKAGE_NAME } from "./scan-prep-pack-artifact.ts";

type NpmjsVersionAvailabilityResult =
  | { kind: "published"; version: string }
  | { kind: "not_found" }
  | { kind: "unavailable"; message: string };

function cleanNpmEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_TOKEN;
  delete env.NPM_CONFIG_USERCONFIG;
  return env;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasNpmErrorCodeE404(output: string): boolean {
  return /npm error code E404\b/i.test(output) || /(?:^|\s)E404\b/.test(output);
}

export function isConfirmedExactScanPrepVersionNotFound(
  output: string,
  version: string,
): boolean {
  if (!hasNpmErrorCodeE404(output)) {
    return false;
  }

  const spec = `${PACKAGE_NAME}@${version}`;
  const escapedSpec = escapeRegExp(spec);
  const escapedPackage = escapeRegExp(PACKAGE_NAME);
  const encodedPackage = PACKAGE_NAME.replace("/", "%2f");

  if (
    new RegExp(`No match found for version ${escapedSpec}\\b`, "i").test(output)
  ) {
    return true;
  }

  if (new RegExp(escapedSpec, "i").test(output)) {
    return true;
  }

  if (
    new RegExp(`${escapedPackage}@${escapeRegExp(version)}\\b`, "i").test(
      output,
    )
  ) {
    return true;
  }

  if (
    new RegExp(encodedPackage, "i").test(output) &&
    /(?:Not [Ff]ound|404)/.test(output) &&
    !new RegExp(
      `No match found for version @(?!${escapeRegExp(PACKAGE_NAME)}@)`,
      "i",
    ).test(output)
  ) {
    return true;
  }

  return false;
}

export function classifyNpmjsScanPrepVersionAvailability(
  version: string,
): NpmjsVersionAvailabilityResult {
  const spec = `${PACKAGE_NAME}@${version}`;
  try {
    const stdout = execFileSync(
      "npm",
      ["view", spec, "version", "--registry", NPMJS_REGISTRY],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: cleanNpmEnv(),
      },
    ).trim();

    if (stdout !== version) {
      return {
        kind: "unavailable",
        message: `npm view returned unexpected version for ${spec} (expected ${version}, got ${stdout || "<empty>"})`,
      };
    }

    return { kind: "published", version: stdout };
  } catch (error) {
    const execError = error as {
      status?: number;
      stderr?: Buffer | string;
      stdout?: Buffer | string;
      message?: string;
    };
    const combined = [
      String(execError.stderr ?? ""),
      String(execError.stdout ?? ""),
      String(execError.message ?? ""),
    ].join("\n");

    if (isConfirmedExactScanPrepVersionNotFound(combined, version)) {
      return { kind: "not_found" };
    }

    const summary =
      combined.trim() ||
      `npm view failed for ${spec} with exit status ${execError.status ?? "unknown"}`;
    return { kind: "unavailable", message: summary };
  }
}
