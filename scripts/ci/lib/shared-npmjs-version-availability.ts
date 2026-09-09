/**
 * Evidence-honest npmjs version availability checks for @mergesignal/shared.
 */
import { execFileSync } from "node:child_process";

import { NPMJS_REGISTRY } from "./scan-prep-pack-artifact.ts";
import { cleanNpmEnv } from "./scan-prep-npmjs-version-availability.ts";

const SHARED_PACKAGE_NAME = "@mergesignal/shared";

type NpmjsVersionAvailabilityResult =
  | { kind: "published"; version: string }
  | { kind: "not_found" }
  | { kind: "unavailable"; message: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasNpmErrorCodeE404(output: string): boolean {
  return /npm error code E404\b/i.test(output) || /(?:^|\s)E404\b/.test(output);
}

export function isConfirmedExactSharedVersionNotFound(
  output: string,
  version: string,
): boolean {
  if (!hasNpmErrorCodeE404(output)) {
    return false;
  }

  const spec = `${SHARED_PACKAGE_NAME}@${version}`;
  const escapedSpec = escapeRegExp(spec);
  const escapedPackage = escapeRegExp(SHARED_PACKAGE_NAME);
  const encodedPackage = SHARED_PACKAGE_NAME.replace("/", "%2f");

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
      `No match found for version @(?!${escapeRegExp(SHARED_PACKAGE_NAME)}@)`,
      "i",
    ).test(output)
  ) {
    return true;
  }

  return false;
}

export function classifyNpmjsSharedVersionAvailability(
  version: string,
): NpmjsVersionAvailabilityResult {
  const spec = `${SHARED_PACKAGE_NAME}@${version}`;
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

    if (isConfirmedExactSharedVersionNotFound(combined, version)) {
      return { kind: "not_found" };
    }

    const summary =
      combined.trim() ||
      `npm view failed for ${spec} with exit status ${execError.status ?? "unknown"}`;
    return { kind: "unavailable", message: summary };
  }
}
