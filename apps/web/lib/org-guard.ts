import "server-only";

import { redirect } from "next/navigation";
import { auth } from "../auth";
import { getLinkedOwnerMismatch, userCanAccessGithubOwner } from "./access";
import { isDevAuthBypass } from "./dev-auth";

export async function requireOrgAccess(owner: string): Promise<void> {
  if (isDevAuthBypass()) return;

  const session = await auth();
  if (!session) {
    redirect(
      `/api/auth/signin/github?callbackUrl=/org/${encodeURIComponent(owner)}`,
    );
  }

  const linkedErr = getLinkedOwnerMismatch(owner);
  if (linkedErr) {
    redirect(`/?error=${encodeURIComponent(linkedErr.message)}`);
  }

  if (!userCanAccessGithubOwner(session, owner)) {
    redirect("/?error=forbidden");
  }
}
