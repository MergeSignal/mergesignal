#!/usr/bin/env tsx
/**
 * CI guard: `@mergesignal/scan-prep` is the sole upgraded-package authority.
 * Fails when peer-context churn or normalized version semantics regress.
 */
import {
  PEER_CONTEXT_CHURN_MANIFESTS,
  peerContextChurnBaseLockfile,
  peerContextChurnHeadLockfile,
} from "../packages/scan-prep/src/__fixtures__/pnpm-peer-context-churn.fixture.js";
import {
  WORKSPACE_PEER_CONTEXT_REWRITE_MANIFESTS,
  peerContextRewriteBaseLockfile,
  peerContextRewriteHeadLockfile,
} from "../packages/scan-prep/src/__fixtures__/pnpm-peer-context-rewrite-fixtures.js";
import {
  detectChangedPackages,
  detectLockfilePackageDelta,
  importerManifestPath,
  normalizePnpmResolvedVersion,
} from "../packages/scan-prep/src/lockfile-diff.js";

function assertEqual<T>(label: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${label}: expected ${e}, got ${a}`);
  }
}

function main(): void {
  if (typeof detectChangedPackages !== "function") {
    throw new Error("scan-prep authority: detectChangedPackages missing");
  }
  if (typeof normalizePnpmResolvedVersion !== "function") {
    throw new Error(
      "scan-prep authority: normalizePnpmResolvedVersion missing",
    );
  }
  if (importerManifestPath(".") !== "package.json") {
    throw new Error("scan-prep authority: importerManifestPath regression");
  }

  const rewriteOpts = {
    changedPackageJsonFiles: [...WORKSPACE_PEER_CONTEXT_REWRITE_MANIFESTS],
  };
  const rewriteChanged = detectChangedPackages(
    peerContextRewriteBaseLockfile,
    peerContextRewriteHeadLockfile,
    "pnpm",
    rewriteOpts,
  );
  const rewriteDelta = detectLockfilePackageDelta(
    peerContextRewriteBaseLockfile,
    peerContextRewriteHeadLockfile,
    "pnpm",
    rewriteOpts,
  );

  assertEqual("peer-context rewrite changedPackages", rewriteChanged, [
    "typescript",
  ]);
  assertEqual("peer-context rewrite lockfile delta", rewriteDelta, {
    added: [],
    removed: [],
    updated: ["typescript"],
  });

  const opts = { changedPackageJsonFiles: [...PEER_CONTEXT_CHURN_MANIFESTS] };
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

  assertEqual("peer-context churn changedPackages", changed, ["typescript"]);
  assertEqual("peer-context churn lockfile delta", delta, {
    added: [],
    removed: [],
    updated: ["typescript"],
  });

  const peerOnly =
    normalizePnpmResolvedVersion(
      "5.88.1(@emnapi/core@1.10.0)(@types/node@22.15.3)(typescript@5.9.2)",
    ) ===
    normalizePnpmResolvedVersion(
      "5.88.1(@emnapi/core@1.10.0)(@types/node@22.15.3)(typescript@5.9.3)",
    );
  if (!peerOnly) {
    throw new Error(
      "scan-prep authority: peer suffix normalization regression",
    );
  }

  const realVersionChange =
    normalizePnpmResolvedVersion("4.17.20") !==
    normalizePnpmResolvedVersion("4.17.21");
  if (!realVersionChange) {
    throw new Error(
      "scan-prep authority: normalized version transition regression",
    );
  }

  process.stdout.write("scan-prep authority check OK\n");
}

main();
