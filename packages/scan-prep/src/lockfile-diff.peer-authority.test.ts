import { describe, expect, it } from "vitest";

import {
  PEER_CONTEXT_CHURN_MANIFESTS,
  peerContextChurnBaseLockfile,
  peerContextChurnHeadLockfile,
} from "./__fixtures__/pnpm-peer-context-churn.fixture.js";
import {
  detectChangedPackages,
  detectLockfilePackageDelta,
  normalizePnpmResolvedVersion,
} from "./lockfile-diff.js";

const specifierOnlyBase = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      left-pad:
        specifier: ^1.2.0
        version: 1.2.3
packages:
  left-pad@1.2.3:
    resolution: {integrity: sha512-leftpad}
`;

const specifierOnlyHead = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      left-pad:
        specifier: ~1.2.0
        version: 1.2.3
packages:
  left-pad@1.2.3:
    resolution: {integrity: sha512-leftpad}
`;

const resolvedUpgradeBase = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      lodash:
        specifier: ^4.17.0
        version: 4.17.20
packages:
  lodash@4.17.20:
    resolution: {integrity: sha512-lodash420}
`;

const resolvedUpgradeHead = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      lodash:
        specifier: ^4.17.0
        version: 4.17.21
packages:
  lodash@4.17.21:
    resolution: {integrity: sha512-lodash421}
`;

describe("normalizePnpmResolvedVersion", () => {
  it("strips peer-instantiation suffixes while preserving protocol forms", () => {
    expect(
      normalizePnpmResolvedVersion(
        "5.88.1(@emnapi/core@1.10.0)(@types/node@22.15.3)(typescript@5.9.2)",
      ),
    ).toBe("5.88.1");
    expect(normalizePnpmResolvedVersion("5.9.3")).toBe("5.9.3");
    expect(normalizePnpmResolvedVersion("npm:alias-package@1.2.3")).toBe(
      "npm:alias-package@1.2.3",
    );
    expect(normalizePnpmResolvedVersion("workspace:*")).toBe("workspace:*");
    expect(normalizePnpmResolvedVersion("link:../package")).toBe(
      "link:../package",
    );
    expect(normalizePnpmResolvedVersion("file:../package")).toBe(
      "file:../package",
    );
  });
});

describe("pnpm peer-context churn authority", () => {
  it("reports typescript only for multi-peer knip suffix rewrite", () => {
    const opts = {
      changedPackageJsonFiles: [...PEER_CONTEXT_CHURN_MANIFESTS],
    };
    const changed = detectChangedPackages(
      peerContextChurnBaseLockfile,
      peerContextChurnHeadLockfile,
      "pnpm",
      opts,
    );
    const delta = detectLockfilePackageDelta(
      peerContextChurnBaseLockfile,
      peerContextChurnHeadLockfile,
      "pnpm",
      opts,
    );

    expect(changed).toEqual(["typescript"]);
    expect(delta).toEqual({ added: [], removed: [], updated: ["typescript"] });
    expect(changed).not.toContain("knip");
    expect(delta.updated).not.toContain("knip");
  });

  it("detects legitimate specifier-only changes", () => {
    const changed = detectChangedPackages(
      specifierOnlyBase,
      specifierOnlyHead,
      "pnpm",
    );
    const delta = detectLockfilePackageDelta(
      specifierOnlyBase,
      specifierOnlyHead,
      "pnpm",
    );

    expect(changed).toEqual(["left-pad"]);
    expect(delta.updated).toContain("left-pad");
  });

  it("detects resolved-version changes under an unchanged specifier", () => {
    const changed = detectChangedPackages(
      resolvedUpgradeBase,
      resolvedUpgradeHead,
      "pnpm",
    );
    const delta = detectLockfilePackageDelta(
      resolvedUpgradeBase,
      resolvedUpgradeHead,
      "pnpm",
    );

    expect(changed).toEqual(["lodash"]);
    expect(delta.updated).toContain("lodash");
  });
});
