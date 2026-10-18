export type WebScanRepositoryGate = "repository" | "unavailable";

/**
 * Local scans persist repo_id as `{authenticatedOwner}/{scanId}`.
 * That equality is the only row fact written solely by local ingress.
 * GitHub and manual scans persist a repository name that is not the scan id.
 */
export function webScanRepositoryGate(scan: {
  id: string;
  repoId: string;
}): WebScanRepositoryGate {
  const slash = scan.repoId.indexOf("/");
  if (slash <= 0 || scan.repoId.indexOf("/", slash + 1) !== -1) {
    return "repository";
  }
  const suffix = scan.repoId.slice(slash + 1);
  if (suffix.length > 0 && suffix === scan.id) return "unavailable";
  return "repository";
}
