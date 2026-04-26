import { NextResponse } from "next/server";
import { auth } from "./auth";
import { isDevAuthBypass } from "./lib/dev-auth";

export default auth((req) => {
  if (isDevAuthBypass()) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const isProtectedApp =
    pathname.startsWith("/org") ||
    pathname.startsWith("/scan") ||
    pathname.startsWith("/app");

  const isProtectedApi =
    pathname.startsWith("/api/scan") || pathname.startsWith("/api/benchmark");

  if ((isProtectedApp || isProtectedApi) && !req.auth) {
    const signIn = new URL("/api/auth/signin/github", req.nextUrl.origin);
    signIn.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signIn);
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
