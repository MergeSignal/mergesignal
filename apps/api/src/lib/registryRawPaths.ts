import get from "lodash/get.js";

/**
 * Reads `repository.url` from npm registry `raw` JSON blobs stored in package_health.
 * Uses lodash path access for nested shapes without assuming a full schema.
 * Returns `undefined` when the path is missing or not a non-empty string.
 */
export function readRepositoryUrlFromRegistryRaw(
  raw: unknown,
): string | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const url: unknown = get(raw, "repository.url");
  return typeof url === "string" && url.trim().length > 0
    ? url.trim()
    : undefined;
}
