import { NextResponse } from "next/server";
import { auth } from "./auth";
import { isDevAuthBypass } from "./lib/dev-auth";
import {
  AuthLogEvent,
  isProtectedApiPath,
  isProtectedAppPath,
  logAuthEvent,
  resolveUnauthenticatedMiddlewareResponse,
} from "./lib/auth";

export default auth((req) => {
  if (isDevAuthBypass()) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const isProtected =
    isProtectedAppPath(pathname) || isProtectedApiPath(pathname);

  if (isProtected && !req.auth) {
    const result = resolveUnauthenticatedMiddlewareResponse({
      pathname,
      search: req.nextUrl.search,
    });

    if (result.kind === "unauthorized") {
      logAuthEvent(AuthLogEvent.MiddlewareApiUnauthorized, { pathname });
      return new NextResponse("Unauthorized", { status: 401 });
    }

    logAuthEvent(AuthLogEvent.MiddlewareUnauthenticated, {
      pathname,
      redirectTo: result.redirectTo,
    });
    return NextResponse.redirect(new URL(result.location, req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/org/:path*",
    "/scan/:path*",
    "/app/:path*",
    "/api/scan/:path*",
    "/api/benchmark/:path*",
  ],
};
