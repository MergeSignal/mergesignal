import {
  ALLOWED_REDIRECT_PREFIXES,
  DEFAULT_AUTH_PROVIDER,
  DEFAULT_REDIRECT_FALLBACK,
} from "./constants";
import { AuthLogEvent, logAuthEvent } from "./logging";

function decodeForInspection(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hasUnsafeProtocol(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes("http:") || lower.includes("https:");
}

function isUnsafeRedirect(value: string): boolean {
  const decoded = decodeForInspection(value.trim());
  if (!decoded.startsWith("/")) return true;
  if (decoded.startsWith("//")) return true;
  if (decoded.startsWith("\\")) return true;
  if (hasUnsafeProtocol(decoded)) return true;
  if (value.toLowerCase().includes("%2f%2f")) return true;
  if (value.toLowerCase().includes("%5c%5c")) return true;
  return false;
}

function hasAllowedPrefix(path: string): boolean {
  return ALLOWED_REDIRECT_PREFIXES.some((prefix) => {
    if (prefix === "/") {
      return path === "/" || path.startsWith("/?");
    }
    return path === prefix || path.startsWith(prefix + "/");
  });
}

export function relativePathFromUrl(url: string): string {
  try {
    const parsed = new URL(url, "http://local");
    return parsed.pathname + parsed.search;
  } catch {
    return url.startsWith("/") ? url : "/" + url;
  }
}

export function sanitizeRedirectTo(
  input: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT_FALLBACK,
): string {
  const candidate = (input ?? "").trim();
  if (!candidate) return fallback;

  const normalized = candidate.startsWith("/")
    ? candidate
    : relativePathFromUrl(candidate);

  if (isUnsafeRedirect(normalized)) {
    logAuthEvent(AuthLogEvent.SignInInvalidRedirect, {
      redirectTo: candidate,
    });
    return fallback;
  }

  const pathOnly = normalized.split("?")[0] ?? normalized;
  if (!hasAllowedPrefix(pathOnly)) {
    logAuthEvent(AuthLogEvent.SignInInvalidRedirect, {
      redirectTo: normalized,
    });
    return fallback;
  }

  return normalized;
}

export function buildProviderSignInPath(
  provider: string = DEFAULT_AUTH_PROVIDER,
  redirectTo: string,
): string {
  const safe = sanitizeRedirectTo(redirectTo);
  return (
    "/api/auth/signin/" +
    encodeURIComponent(provider) +
    "?redirectTo=" +
    encodeURIComponent(safe)
  );
}
