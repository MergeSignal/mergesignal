#!/usr/bin/env tsx
/**
 * Send scan-prep-package-released repository_dispatch to mergesignal-engine.
 */
import { dispatchScanPrepPackageReleased } from "./lib/scan-prep-engine-dispatch.ts";

function parseArgs(argv: string[]): {
  version: string;
  tag: string;
  commitSha: string;
} {
  let version: string | undefined;
  let tag: string | undefined;
  let commitSha: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith("--version=")) {
      version = arg.slice("--version=".length);
      continue;
    }
    if (arg.startsWith("--tag=")) {
      tag = arg.slice("--tag=".length);
      continue;
    }
    if (arg.startsWith("--commit-sha=")) {
      commitSha = arg.slice("--commit-sha=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: dispatch-scan-prep-package-released.ts --version=X.Y.Z --tag=scan-prep-vX.Y.Z --commit-sha=<40-char-sha>",
      );
      process.exit(0);
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  if (!version || !tag || !commitSha) {
    throw new Error(
      "Required: --version=X.Y.Z --tag=scan-prep-vX.Y.Z --commit-sha=<40-char-sha>",
    );
  }

  return { version, tag, commitSha };
}

function main(): void {
  const { version, tag, commitSha } = parseArgs(process.argv.slice(2));
  const ghToken = process.env.MERGESIGNAL_ENGINE_DISPATCH_TOKEN ?? "";
  const engineRepo = process.env.MERGESIGNAL_ENGINE_REPOSITORY ?? "";

  dispatchScanPrepPackageReleased({
    version,
    tag,
    commitSha,
    ghToken,
    engineRepo,
  });

  console.log(
    `Engine dispatch sent: ${tag} @ ${commitSha} (${version}) to ${engineRepo || "MergeSignal/mergesignal-engine"}`,
  );
}

main();
