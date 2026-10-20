const PRODUCTION_API_ORIGIN = "https://mergesignal-api.fly.dev";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

type ApiOriginResolution =
  | { ok: true; origin: URL }
  | { ok: false; code: "invalid_origin" };

/** Production origin when unset. An explicit value is accepted only for loopback. */
export function resolveApiOrigin(
  configured: string | undefined,
): ApiOriginResolution {
  if (configured === undefined) {
    return { ok: true, origin: new URL(PRODUCTION_API_ORIGIN) };
  }
  let url: URL;
  try {
    url = new URL(configured.trim());
  } catch {
    return { ok: false, code: "invalid_origin" };
  }
  if (!isLoopbackOrigin(url)) return { ok: false, code: "invalid_origin" };
  return { ok: true, origin: url };
}

/** Destinations that may receive the CLI bearer token. */
export function isBearerDestination(origin: URL): boolean {
  if (!hasOriginOnly(origin)) return false;
  const host = normalizeHost(origin.hostname);
  if (host === "mergesignal-api.fly.dev") return origin.protocol === "https:";
  if (!LOOPBACK_HOSTS.has(host)) return false;
  return origin.protocol === "http:" || origin.protocol === "https:";
}

function isLoopbackOrigin(origin: URL): boolean {
  if (!hasOriginOnly(origin)) return false;
  const host = normalizeHost(origin.hostname);
  if (!LOOPBACK_HOSTS.has(host)) return false;
  return origin.protocol === "http:" || origin.protocol === "https:";
}

function hasOriginOnly(origin: URL): boolean {
  if (origin.username !== "" || origin.password !== "") return false;
  if (origin.search !== "" || origin.hash !== "") return false;
  return origin.pathname === "" || origin.pathname === "/";
}

function normalizeHost(hostname: string): string {
  const host = hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) return host.slice(1, -1);
  return host;
}
