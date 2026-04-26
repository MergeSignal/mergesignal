import type { Session } from "next-auth";

/** GitHub owner segment for a repo id `owner/name`. */
export function repoOwnerFromRepoId(repoId: string): string {
  const trimmed = repoId.trim();
  return trimmed.includes("/") ? trimmed.split("/")[0]! : trimmed;
}

export function userCanAccessGithubOwner(
  session: Session | null,
  owner: string,
): boolean {
  if (!session?.user) return false;
  if (session.githubLogin && session.githubLogin === owner) return true;
  const orgs = session.githubOrgs ?? [];
  return orgs.includes(owner);
}

export function getLinkedOwnerMismatch(
  routeOwner: string,
): { status: number; message: string } | null {
  const linked = process.env.MERGESIGNAL_LINKED_GITHUB_OWNER?.trim();
  if (!linked) {
    return {
      status: 500,
      message:
        "Server misconfiguration: MERGESIGNAL_LINKED_GITHUB_OWNER is not set",
    };
  }
  if (linked !== routeOwner) {
    return {
      status: 403,
      message: `This deployment is linked to GitHub owner "${linked}" only.`,
    };
  }
  return null;
}
