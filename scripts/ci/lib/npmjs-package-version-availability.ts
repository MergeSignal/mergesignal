/**
 * Structured npmjs published-version evidence for CI package governance.
 */
import { execFileSync } from "node:child_process";

import { cleanNpmEnv, NPMJS_REGISTRY } from "./npmjs-registry.ts";

type NpmjsVersionAvailabilityResult =
  | { kind: "published"; version: string }
  | { kind: "not_found" }
  | { kind: "unavailable"; message: string };

function formatNpmExecFailure(
  spec: string,
  error: unknown,
): { kind: "unavailable"; message: string } {
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
  const summary =
    combined.trim() ||
    `npm view failed for ${spec} with exit status ${execError.status ?? "unknown"}`;
  return { kind: "unavailable", message: summary };
}

/**
 * Parses `npm view <pkg> versions --json` stdout.
 * Returns null when the response is not a usable version list.
 */
export function parseNpmPublishedVersionsJson(stdout: string): string[] | null {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof parsed === "string") {
    return parsed.length > 0 ? [parsed] : [];
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  if (!parsed.every((entry) => typeof entry === "string")) {
    return null;
  }

  return parsed;
}

export function classifyNpmjsPackageVersionAvailability(
  packageName: string,
  version: string,
): NpmjsVersionAvailabilityResult {
  const spec = `${packageName} versions`;
  try {
    const stdout = execFileSync(
      "npm",
      ["view", packageName, "versions", "--json", "--registry", NPMJS_REGISTRY],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: cleanNpmEnv(),
      },
    );

    const publishedVersions = parseNpmPublishedVersionsJson(stdout);
    if (publishedVersions === null) {
      return {
        kind: "unavailable",
        message: `npm view returned malformed versions JSON for ${packageName}`,
      };
    }

    if (publishedVersions.includes(version)) {
      return { kind: "published", version };
    }

    return { kind: "not_found" };
  } catch (error) {
    return formatNpmExecFailure(spec, error);
  }
}
