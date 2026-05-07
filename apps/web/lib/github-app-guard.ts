import "server-only";

import { redirect } from "next/navigation";
import { auth } from "../auth";
import { userCanAccessGithubOwner } from "./access";
import { isDevAuthBypass } from "./dev-auth";

/**
 * Ensures the signed-in user may use the given GitHub owner scope under /app/*.
 * Does not apply MERGESIGNAL_LINKED_GITHUB_OWNER (that is for /org/* only).
 */
export async function requireGithubAppOwnerAccess(
  owner: string,
): Promise<void> {
  if (isDevAuthBypass()) return;

  const session = await auth();
  if (!session) {
    redirect(
      `/api/auth/signin/github?callbackUrl=${encodeURIComponent(`/app/${encodeURIComponent(owner)}`)}`,
    );
  }

  if (!userCanAccessGithubOwner(session, owner)) {
    redirect("/app?error=forbidden");
  }
}
