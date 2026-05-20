import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Session } from "next-auth";
import { GET } from "./route";
import { auth as getServerSession } from "../../../../auth";

vi.mock("../../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../../lib/dev-auth", () => ({
  isDevAuthBypass: () => false,
}));

vi.mock("../../../../lib/server-api", () => ({
  serverApiFetch: vi.fn(),
}));

import { serverApiFetch } from "../../../../lib/server-api";

describe("benchmark repo route", () => {
  const prevLinked = process.env.MERGESIGNAL_LINKED_GITHUB_OWNER;

  beforeEach(() => {
    process.env.MERGESIGNAL_LINKED_GITHUB_OWNER = "acme-corp";
  });

  afterEach(() => {
    if (prevLinked === undefined)
      delete process.env.MERGESIGNAL_LINKED_GITHUB_OWNER;
    else process.env.MERGESIGNAL_LINKED_GITHUB_OWNER = prevLinked;
  });
  const authMock = vi.mocked(getServerSession) as unknown as {
    mockResolvedValue: (value: Session | null) => void;
    mockReset: () => void;
  };
  const fetchMock = vi.mocked(serverApiFetch);

  beforeEach(() => {
    fetchMock.mockReset();
    authMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without session", async () => {
    authMock.mockResolvedValue(null);

    const req = new Request("http://localhost/x?repoId=acme%2Frepo");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 403 when org is not allowed", async () => {
    authMock.mockResolvedValue({
      user: { name: "Alice" },
      githubLogin: "alice",
      githubOrgs: ["acme-corp"],
      accessToken: "fake-token",
      expires: "2099-01-01",
    } as Session);

    const req = new Request("http://localhost/x?repoId=other-org%2Frepo");
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
