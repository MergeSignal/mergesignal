import "server-only";

import { redirect } from "next/navigation";
import { auth } from "../auth";
import { getLinkedOwnerMismatch, userCanAccessGithubOwner } from "./access";
import { isDevAuthBypass } from "./dev-auth";
import {
  AuthLogEvent,
  DEFAULT_AUTH_PROVIDER,
  buildProviderSignInPath,
  logAuthEvent,
} from "./auth";

export async function requireOrgAccess(
  owner: string,
  options?: { redirectTo?: string },
): Promise<void> {
  if (isDevAuthBypass()) return;

  const session = await auth();
  if (!session) {
    const redirectTo =
      options?.redirectTo ?? "/org/" + encodeURIComponent(owner);
    logAuthEvent(AuthLogEvent.GuardUnauthenticated, { redirectTo });
    redirect(buildProviderSignInPath(DEFAULT_AUTH_PROVIDER, redirectTo));
  }

  const linkedErr = getLinkedOwnerMismatch(owner);
  if (linkedErr) {
    redirect("/?error=" + encodeURIComponent(linkedErr.message));
  }

  if (!userCanAccessGithubOwner(session, owner)) {
    redirect("/?error=forbidden");
  }
}
