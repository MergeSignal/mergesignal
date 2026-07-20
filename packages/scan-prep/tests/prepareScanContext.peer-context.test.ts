import { describe, expect, it } from "vitest";

import {
  PEER_CONTEXT_CHURN_MANIFESTS,
  peerContextChurnBaseLockfile,
  peerContextChurnHeadLockfile,
} from "../src/__fixtures__/pnpm-peer-context-churn.fixture.js";
import { prepareScanContext } from "../src/prepareScanContext.js";

describe("prepareScanContext peer-context churn", () => {
  it("returns typescript-only changedPackages and lockfile delta", async () => {
    const prepared = await prepareScanContext({
      scanId: "peer-context-churn",
      repoId: "MergeSignal/mergesignal",
      dependencyGraph: {},
      lockfile: { manager: "pnpm", content: peerContextChurnHeadLockfile },
      baseLockfile: {
        manager: "pnpm",
        content: peerContextChurnBaseLockfile,
      },
      changedFiles: ["pnpm-lock.yaml", "package.json"],
      changedPackageJsonFiles: [...PEER_CONTEXT_CHURN_MANIFESTS],
    });

    expect(prepared.scanRequest.changedPackages).toEqual(["typescript"]);
    expect(prepared.scanRequest.lockfilePackageDelta).toEqual({
      added: [],
      removed: [],
      updated: ["typescript"],
    });
    expect(prepared.scanRequest.changedPackages).not.toContain("knip");
    expect(prepared.scanRequest.lockfilePackageDelta?.updated).not.toContain(
      "knip",
    );
  });
});
