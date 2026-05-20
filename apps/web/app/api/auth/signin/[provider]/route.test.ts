import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { signIn as initiateAuth } from "../../../../../auth";

vi.mock("../../../../../auth", () => ({
  signIn: vi.fn(),
}));

describe("GET signin provider route", () => {
  const initiateMock = vi.mocked(initiateAuth);

  beforeEach(() => {
    initiateMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initiates oauth", async () => {
    initiateMock.mockRejectedValue({ digest: "NEXT_REDIRECT;push;/x;307;" });

    const provider = "github";
    const req = new Request(
      "http://localhost/api/auth/signin/github?redirectTo=%2Fscan%2Fabc",
    );
    await expect(
      GET(req as never, { params: Promise.resolve({ provider }) }),
    ).rejects.toEqual({ digest: "NEXT_REDIRECT;push;/x;307;" });

    expect(initiateMock).toHaveBeenCalledWith(provider, {
      redirectTo: "/scan/abc",
    });
  });

  it("returns 400 for unsupported provider", async () => {
    const req = new Request("http://localhost/api/auth/signin/google");
    const res = await GET(req as never, {
      params: Promise.resolve({ provider: "google" }),
    });
    expect(res.status).toBe(400);
    expect(initiateMock).not.toHaveBeenCalled();
  });

  it("returns 500 on AuthError", async () => {
    initiateMock.mockRejectedValue({
      type: "Configuration",
      message: "bad config",
    });

    const req = new Request("http://localhost/api/auth/signin/github");
    const res = await GET(req as never, {
      params: Promise.resolve({ provider: "github" }),
    });
    expect(res.status).toBe(500);
  });
});
