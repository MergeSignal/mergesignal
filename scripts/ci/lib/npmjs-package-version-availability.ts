/**
 * Structured npmjs published-version evidence for CI package governance.
 *
 * Uses the registry exact-version HTTP contract:
 * GET <registry>/<encoded-package>/<version>
 */
import {
  buildNpmjsPackageVersionUrl,
  NPMJS_REGISTRY,
} from "./npmjs-registry.ts";

type NpmjsVersionAvailabilityResult =
  | { kind: "published"; version: string }
  | { kind: "not_found" }
  | { kind: "unavailable"; message: string };

type NpmjsPackageVersionDocument = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
};

const DEFAULT_TIMEOUT_MS = 30_000;

type PublicationQueryResult =
  | { kind: "published"; document: NpmjsPackageVersionDocument }
  | { kind: "not_found" }
  | { kind: "unavailable"; message: string };

type NpmjsPublicationQueryOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  registry?: string;
};

function unavailable(message: string): PublicationQueryResult {
  return { kind: "unavailable", message };
}

/**
 * Validates a registry exact-version JSON document from HTTP 200.
 */
export function parseNpmjsPackageVersionDocument(
  body: string,
  expectedPackageName: string,
  expectedVersion: string,
): NpmjsPackageVersionDocument | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (
    typeof record.name !== "string" ||
    typeof record.version !== "string" ||
    record.name !== expectedPackageName ||
    record.version !== expectedVersion
  ) {
    return null;
  }

  const dependencies =
    record.dependencies === undefined
      ? undefined
      : typeof record.dependencies === "object" &&
          record.dependencies !== null &&
          !Array.isArray(record.dependencies)
        ? (record.dependencies as Record<string, string>)
        : undefined;

  if (record.dependencies !== undefined && dependencies === undefined) {
    return null;
  }

  return {
    name: record.name,
    version: record.version,
    dependencies,
  };
}

export function readSharedDependencyPinFromNpmjsPackageVersionDocument(
  document: NpmjsPackageVersionDocument,
  dependencyName = "@mergesignal/shared",
): string {
  const pin = document.dependencies?.[dependencyName];
  if (typeof pin !== "string" || !pin.trim()) {
    throw new Error(
      `published ${document.name}@${document.version} is missing dependencies.${dependencyName} on npmjs`,
    );
  }
  return pin;
}

/**
 * Maps an exact-version registry HTTP response to publication evidence.
 */
export function classifyNpmjsPublicationFromHttpResponse(
  status: number,
  body: string,
  packageName: string,
  version: string,
): PublicationQueryResult {
  if (status === 404) {
    return { kind: "not_found" };
  }

  if (status === 401 || status === 403) {
    return unavailable(
      `npmjs registry returned HTTP ${status} for ${packageName}@${version}`,
    );
  }

  if (status === 408 || status === 429) {
    return unavailable(
      `npmjs registry returned HTTP ${status} for ${packageName}@${version}`,
    );
  }

  if (status >= 500) {
    return unavailable(
      `npmjs registry returned HTTP ${status} for ${packageName}@${version}`,
    );
  }

  if (status !== 200) {
    return unavailable(
      `npmjs registry returned unexpected HTTP ${status} for ${packageName}@${version}`,
    );
  }

  const document = parseNpmjsPackageVersionDocument(body, packageName, version);
  if (!document) {
    return unavailable(
      `npmjs registry returned malformed exact-version JSON for ${packageName}@${version}`,
    );
  }

  return { kind: "published", document };
}

export async function queryNpmjsExactPackageVersionPublication(
  packageName: string,
  version: string,
  options: NpmjsPublicationQueryOptions = {},
): Promise<PublicationQueryResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = buildNpmjsPackageVersionUrl(
    packageName,
    version,
    options.registry ?? NPMJS_REGISTRY,
  );

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.text();
    return classifyNpmjsPublicationFromHttpResponse(
      response.status,
      body,
      packageName,
      version,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "unknown error");
    return unavailable(
      `npmjs registry request failed for ${packageName}@${version}: ${message}`,
    );
  }
}

export async function classifyNpmjsPackageVersionAvailability(
  packageName: string,
  version: string,
  options?: NpmjsPublicationQueryOptions,
): Promise<NpmjsVersionAvailabilityResult> {
  const result = await queryNpmjsExactPackageVersionPublication(
    packageName,
    version,
    options,
  );

  if (result.kind === "published") {
    return { kind: "published", version: result.document.version };
  }

  return result;
}
