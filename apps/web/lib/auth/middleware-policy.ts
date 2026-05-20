import { DEFAULT_AUTH_PROVIDER } from "./constants";
import { buildProviderSignInPath, sanitizeRedirectTo } from "./redirect";

export function isProtectedAppPath(pathname: string): boolean {
  return (
    pathname.startsWith("/org") ||
    pathname.startsWith("/scan") ||
    pathname.startsWith("/app")
  );
}

export function isProtectedApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/scan") || pathname.startsWith("/api/benchmark")
  );
}

export type UnauthenticatedMiddlewareResult =
  | { kind: "redirect"; location: string; redirectTo: string }
  | { kind: "unauthorized" };

export function resolveUnauthenticatedMiddlewareResponse(input: {
  pathname: string;
  search?: string;
}): UnauthenticatedMiddlewareResult {
  if (isProtectedApiPath(input.pathname)) {
    return { kind: "unauthorized" };
  }

  const redirectTo = sanitizeRedirectTo(input.pathname + (input.search ?? ""));

  return {
    kind: "redirect",
    redirectTo,
    location: buildProviderSignInPath(DEFAULT_AUTH_PROVIDER, redirectTo),
  };
}
