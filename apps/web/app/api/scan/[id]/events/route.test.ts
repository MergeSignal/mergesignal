import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { GET } from "./route";
import { auth as getServerSession } from "../../../../../auth";

vi.mock("../../../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../../../lib/dev-auth", () => ({
  isDevAuthBypass: () => false,
}));

vi.mock("../../../../../lib/server-api", () => ({
  serverApiFetch: vi.fn(),
}));

vi.mock("../../../../../lib/repo-guard", () => ({
  checkRepoAccessForSession: vi.fn(),
}));

import { serverApiFetch } from "../../../../../lib/server-api";
import { checkRepoAccessForSession } from "../../../../../lib/repo-guard";

describe("scan events route", () => {
  const authMock = vi.mocked(getServerSession) as unknown as {
    mockResolvedValue: (value: Session | null) => void;
    mockReset: () => void;
  };
  const fetchMock = vi.mocked(serverApiFetch);
  const accessMock = vi.mocked(checkRepoAccessForSession);

  beforeEach(() => {
    fetchMock.mockReset();
    authMock.mockReset();
    accessMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without session", async () => {
    authMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 403 when repo access is denied", async () => {
    const session = {
      user: { name: "Alice" },
      githubLogin: "alice",
      githubOrgs: ["acme-corp"],
      accessToken: "fake-token",
      expires: "2099-01-01",
    } as Session;

    authMock.mockResolvedValue(session);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ repo_id: "other-org/repo" }), {
        status: 200,
      }),
    );
    accessMock.mockResolvedValueOnce("forbidden");

    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(403);
    expect(accessMock).toHaveBeenCalledWith(session, "other-org", "repo");
  });
});
