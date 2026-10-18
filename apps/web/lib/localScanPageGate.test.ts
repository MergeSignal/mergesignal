import { describe, expect, it } from "vitest";
import { webScanRepositoryGate } from "./localScanPageGate";

describe("webScanRepositoryGate", () => {
  it("keeps repository ACL for a GitHub push scan without a PR or head SHA", () => {
    const gate = webScanRepositoryGate({
      id: "delivery-1",
      repoId: "acme/app",
    });
    expect(gate).toBe("repository");
  });

  it("keeps repository ACL for a pull request scan and a manual GitHub scan", () => {
    expect(webScanRepositoryGate({ id: "scan-pr", repoId: "acme/app" })).toBe(
      "repository",
    );
    expect(
      webScanRepositoryGate({
        id: "11111111-1111-1111-1111-111111111111",
        repoId: "acme/app",
      }),
    ).toBe("repository");
  });

  it("fails closed for the server-assigned local accounting id", () => {
    const id = "22222222-2222-2222-2222-222222222222";
    expect(webScanRepositoryGate({ id, repoId: `acme/${id}` })).toBe(
      "unavailable",
    );
  });
});
