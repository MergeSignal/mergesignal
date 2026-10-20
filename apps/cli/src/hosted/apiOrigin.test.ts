import { describe, expect, it } from "vitest";

import { isBearerDestination, resolveApiOrigin } from "./apiOrigin.js";

describe("API origin", () => {
  it("uses the production origin when no override is set", () => {
    const resolved = resolveApiOrigin(undefined);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.origin.origin).toBe("https://mergesignal-api.fly.dev");
    expect(isBearerDestination(resolved.origin)).toBe(true);
  });

  it("accepts loopback http and https overrides", () => {
    for (const value of [
      "http://localhost:4000",
      "https://localhost",
      "http://127.0.0.1:4000",
      "https://127.0.0.1",
      "http://[::1]:4000",
      "https://[::1]",
    ]) {
      const resolved = resolveApiOrigin(value);
      expect(resolved.ok, value).toBe(true);
      if (!resolved.ok) continue;
      expect(isBearerDestination(resolved.origin), value).toBe(true);
    }
  });

  it("rejects remote overrides, userinfo, and non-origin URLs", () => {
    for (const value of [
      "https://mergesignal-api.fly.dev",
      "http://mergesignal-api.fly.dev",
      "https://example.com",
      "http://example.com",
      "http://user:secret@127.0.0.1:4000",
      "https://127.0.0.1/v1",
      "https://localhost?insecure=1",
      "file:///tmp/api",
      "not a url",
      "",
    ]) {
      expect(resolveApiOrigin(value).ok, value).toBe(false);
    }
    expect(isBearerDestination(new URL("https://example.com"))).toBe(false);
    expect(isBearerDestination(new URL("http://mergesignal-api.fly.dev"))).toBe(
      false,
    );
    expect(isBearerDestination(new URL("https://user:secret@127.0.0.1"))).toBe(
      false,
    );
  });
});
