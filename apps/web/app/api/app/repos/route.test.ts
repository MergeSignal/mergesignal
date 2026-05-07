import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { GET } from "./route";
import { auth as getServerSession } from "../../../../auth";

vi.mock("../../../../auth", () => ({
  auth: vi.fn(),
}));

describe("GET /api/app/repos", () => {
  const authMock = vi.mocked(getServerSession) as unknown as {
    mockResolvedValue: (value: Session | null) => void;
    mockReset: () => void;
  };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    authMock.mockReset();
  });

  it("returns 403 when org is not an allowed owner for the session", async () => {
    authMock.mockResolvedValue({
      user: { name: "Alice" },
      githubLogin: "alice",
      githubOrgs: ["acme-corp"],
      accessToken: "fake-token",
      expires: "2099-01-01",
    } as Session);

    const req = new Request("http://localhost/api/app/repos?org=other-org");
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("allows personal owner matching githubLogin", async () => {
    authMock.mockResolvedValue({
      user: { name: "Alice" },
      githubLogin: "alice",
      githubOrgs: [],
      accessToken: "fake-token",
      expires: "2099-01-01",
    } as Session);

    const req = new Request("http://localhost/api/app/repos?org=alice");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalled();
  });
});
