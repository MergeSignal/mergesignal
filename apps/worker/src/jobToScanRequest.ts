import type { ScanQueueJob, ScanRequest } from "@mergesignal/shared";

export function scanQueueJobToScanRequest(job: ScanQueueJob): ScanRequest {
  const {
    repoId,
    dependencyGraph,
    lockfile,
    baseLockfile,
    repoSource,
    changedFiles,
    github,
  } = job;

  return {
    repoId,
    dependencyGraph: dependencyGraph ?? {},
    lockfile,
    baseLockfile,
    repoSource,
    changedFiles,
    github: github
      ? { owner: github.owner, repo: github.repo, prNumber: github.prNumber }
      : undefined,
  };
}
