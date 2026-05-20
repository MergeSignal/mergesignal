vi.mock("server-only", () => ({}));
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireOrgAccess } from "./org-guard";
import { auth } from "../auth";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock("../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("./dev-auth", () => ({
  isDevAuthBypass: () => false,
}));

describe("requireOrgAccess", () => {
  const authMock = vi.mocked(auth);

  beforeEach(() => {
    redirectMock.mockReset();
    authMock.mockReset();
  });

  it("redirects unauthenticated users to sign-in wrapper", async () => {
    authMock.mockResolvedValue(null as never);

    await expect(requireOrgAccess("acme")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith(
      "/api/auth/signin/github?redirectTo=%2Forg%2Facme",
    );
  });

  it("honors custom return target", async () => {
    authMock.mockResolvedValue(null as never);

    await expect(
      requireOrgAccess("acme", { redirectTo: "/scan/scan-1" }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith(
      "/api/auth/signin/github?redirectTo=%2Fscan%2Fscan-1",
    );
  });
});
