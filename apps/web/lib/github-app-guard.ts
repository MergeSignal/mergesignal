import "server-only";

import { redirect } from "next/navigation";
import { auth } from "../auth";
import { userCanAccessGithubOwner } from "./access";
import { isDevAuthBypass } from "./dev-auth";
import {
  AuthLogEvent,
  DEFAULT_AUTH_PROVIDER,
  buildProviderSignInPath,
  logAuthEvent,
} from "./auth";

export async function requireGithubAppOwnerAccess(
  owner: string,
  options?: { redirectTo?: string },
): Promise<void> {
  if (isDevAuthBypass()) return;

  const session = await auth();
  if (!session) {
    const redirectTo =
      options?.redirectTo ?? "/app/" + encodeURIComponent(owner);
    logAuthEvent(AuthLogEvent.GuardUnauthenticated, { redirectTo });
    redirect(buildProviderSignInPath(DEFAULT_AUTH_PROVIDER, redirectTo));
  }

  if (!userCanAccessGithubOwner(session, owner)) {
    redirect("/app?error=forbidden");
  }
}
