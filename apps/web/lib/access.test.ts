import type { Session } from "next-auth";
import { afterEach, describe, expect, it } from "vitest";
import {
  getLinkedOwnerMismatch,
  repoOwnerFromRepoId,
  userCanAccessGithubOwner,
} from "./access";

function session(partial: Partial<Session>): Session {
  return {
    user: { name: "u", email: "u@x.com" },
    expires: new Date(Date.now() + 3600_000).toISOString(),
    githubOrgs: [],
    ...partial,
  };
}

describe("repoOwnerFromRepoId", () => {
  it("splits owner from repo id", () => {
    expect(repoOwnerFromRepoId("acme/widget")).toBe("acme");
  });

  it("returns bare id when no slash", () => {
    expect(repoOwnerFromRepoId("solo")).toBe("solo");
  });
});

describe("userCanAccessGithubOwner", () => {
  it("allows matching github login", () => {
    const s = session({ githubLogin: "alice", githubOrgs: [] });
    expect(userCanAccessGithubOwner(s, "alice")).toBe(true);
  });

  it("allows org membership", () => {
    const s = session({ githubLogin: "alice", githubOrgs: ["acme", "beta"] });
    expect(userCanAccessGithubOwner(s, "acme")).toBe(true);
    expect(userCanAccessGithubOwner(s, "other")).toBe(false);
  });

  it("rejects without session", () => {
    expect(userCanAccessGithubOwner(null, "acme")).toBe(false);
  });
});

describe("getLinkedOwnerMismatch", () => {
  const prev = process.env.MERGESIGNAL_LINKED_GITHUB_OWNER;
  afterEach(() => {
    process.env.MERGESIGNAL_LINKED_GITHUB_OWNER = prev;
  });

  it("returns error when env unset", () => {
    delete process.env.MERGESIGNAL_LINKED_GITHUB_OWNER;
    const r = getLinkedOwnerMismatch("acme");
    expect(r).not.toBeNull();
    expect(r?.status).toBe(500);
  });

  it("returns error when route owner differs", () => {
    process.env.MERGESIGNAL_LINKED_GITHUB_OWNER = "acme";
    const r = getLinkedOwnerMismatch("other");
    expect(r?.status).toBe(403);
  });

  it("returns null when owners match", () => {
    process.env.MERGESIGNAL_LINKED_GITHUB_OWNER = "acme";
    expect(getLinkedOwnerMismatch("acme")).toBeNull();
  });
});
