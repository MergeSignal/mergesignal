import { describe, expect, it } from "vitest";
import {
  isProtectedApiPath,
  isProtectedAppPath,
  resolveUnauthenticatedMiddlewareResponse,
} from "./middleware-policy";

describe("isProtectedAppPath", () => {
  it("matches org, scan, and app routes", () => {
    expect(isProtectedAppPath("/org/acme")).toBe(true);
    expect(isProtectedAppPath("/scan/abc")).toBe(true);
    expect(isProtectedAppPath("/app/acme")).toBe(true);
    expect(isProtectedAppPath("/")).toBe(false);
  });
});

describe("isProtectedApiPath", () => {
  it("matches scan and benchmark APIs", () => {
    expect(isProtectedApiPath("/api/scan/abc/events")).toBe(true);
    expect(isProtectedApiPath("/api/benchmark/repo")).toBe(true);
    expect(isProtectedApiPath("/api/app/repos")).toBe(false);
  });
});

describe("resolveUnauthenticatedMiddlewareResponse", () => {
  it("redirects page routes to sign-in wrapper", () => {
    const result = resolveUnauthenticatedMiddlewareResponse({
      pathname: "/scan/abc",
      search: "",
    });
    expect(result.kind).toBe("redirect");
    if (result.kind === "redirect") {
      expect(result.location).toBe(
        "/api/auth/signin/github?redirectTo=%2Fscan%2Fabc",
      );
    }
  });

  it("returns unauthorized for protected API routes", () => {
    const result = resolveUnauthenticatedMiddlewareResponse({
      pathname: "/api/scan/abc/events",
    });
    expect(result).toEqual({ kind: "unauthorized" });
  });
});
