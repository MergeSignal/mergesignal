import { describe, expect, it } from "vitest";
import {
  buildProviderSignInPath,
  relativePathFromUrl,
  sanitizeRedirectTo,
} from "./redirect";

describe("sanitizeRedirectTo", () => {
  it("allows scan paths", () => {
    expect(sanitizeRedirectTo("/scan/abc")).toBe("/scan/abc");
  });
  it("allows app paths", () => {
    expect(sanitizeRedirectTo("/app/acme/r1")).toBe("/app/acme/r1");
  });
  it("rejects protocol-relative paths", () => {
    expect(sanitizeRedirectTo("//evil.com")).toBe("/app");
  });
  it("rejects absolute http URLs", () => {
    expect(sanitizeRedirectTo("https://evil.com/x")).toBe("/app");
  });
  it("rejects encoded protocol-relative paths", () => {
    expect(sanitizeRedirectTo("/%2f%2fevil.com")).toBe("/app");
  });
  it("uses fallback for undefined", () => {
    expect(sanitizeRedirectTo(undefined)).toBe("/app");
  });
  it("rejects disallowed prefixes", () => {
    expect(sanitizeRedirectTo("/admin/secret")).toBe("/app");
  });
});

describe("relativePathFromUrl", () => {
  it("extracts pathname and search from absolute URLs", () => {
    expect(relativePathFromUrl("https://example.com/scan/x?q=1")).toBe(
      "/scan/x?q=1",
    );
  });
});

describe("buildProviderSignInPath", () => {
  it("builds redirectTo query param", () => {
    expect(buildProviderSignInPath("github", "/scan/id-1")).toBe(
      "/api/auth/signin/github?redirectTo=%2Fscan%2Fid-1",
    );
  });
});
