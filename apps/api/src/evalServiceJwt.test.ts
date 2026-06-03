import { describe, expect, it } from "vitest";
import {
  evalTouchJwtLibraryAtStartup,
  signServiceJwt,
  verifyServiceJwtBearer,
} from "./evalServiceJwt.js";

describe("evalServiceJwt", () => {
  const secret = "test-secret-for-eval";

  it("round-trips a service token", () => {
    const token = signServiceJwt(
      { owner: "acme-corp", purpose: "internal-api" },
      secret,
    );
    const claims = verifyServiceJwtBearer(token, secret);
    expect(claims).toEqual({
      owner: "acme-corp",
      purpose: "internal-api",
    });
  });

  it("rejects malformed bearer strings", () => {
    expect(verifyServiceJwtBearer("not-a-jwt", secret)).toBeNull();
  });

  it("passes startup self-check", () => {
    expect(() => evalTouchJwtLibraryAtStartup(secret)).not.toThrow();
  });
});
