import "server-only";

import type { Session } from "next-auth";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { auth } from "../auth";
import {
  AuthLogEvent,
  DEFAULT_AUTH_PROVIDER,
  buildProviderSignInPath,
  logAuthEvent,
} from "./auth";

// ---------------------------------------------------------------------------
// Process-level TTL cache for positive repo access checks.
//
// Design notes:
//  - Only successful access checks (HTTP 200) are cached.
//  - 401 and 403/404 results are never cached.
//  - Cache key: userId + owner + repo (userId is the DB UUID from the users
//    table, falling back to githubLogin for sessions predating the column).
//  - Each pod in a k8s deployment has its own independent cache — this is a
//    conscious decision: cross-pod cache misses cause extra GitHub API calls,
//    never incorrect authorization. Correctness is guaranteed by GitHub's API
//    being the authoritative source.
//  - Max 1000 entries enforced by evicting the oldest on overflow.
//  - No extra npm dependency (Map + manual TTL, no lru-cache).
// ---------------------------------------------------------------------------

const TTL_MS = 60_000; // 60 seconds
const MAX_ENTRIES = 1000;

const processCache = new Map<string, { expiresAt: number }>();

function evictIfNeeded(): void {
  if (processCache.size < MAX_ENTRIES) return;
  // Remove the first (oldest) inserted entry
  const firstKey = processCache.keys().next().value;
  if (firstKey !== undefined) processCache.delete(firstKey);
}

export type RepoAccessResult = "ok" | "reauth" | "forbidden";

/**
 * Inner check wrapped with React cache() for per-request memoization.
 * If requireRepoAccess is called multiple times within the same server render
 * (e.g. layout + page) the GitHub check runs only once per request.
 */
const _checkGitHubAccess = cache(
  async (
    userId: string,
    owner: string,
    repo: string,
    accessToken: string,
  ): Promise<RepoAccessResult> => {
    const key = `${userId}:${owner}:${repo}`;
    const now = Date.now();

    const entry = processCache.get(key);
    if (entry && entry.expiresAt > now) return "ok";

    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        // No caching at the HTTP layer — we manage our own TTL
        cache: "no-store",
      },
    );

    if (res.status === 200) {
      evictIfNeeded();
      processCache.set(key, { expiresAt: now + TTL_MS });
      return "ok";
    }

    // 401: token expired — not cached, may succeed after re-auth
    if (res.status === 401) return "reauth";

    // 403 or 404: access denied — not cached, may be granted later
    return "forbidden";
  },
);

/** GitHub repo ACL check for route handlers that return HTTP status codes. */
export async function checkRepoAccessForSession(
  session: Session,
  owner: string,
  repo: string,
): Promise<RepoAccessResult> {
  const accessToken = session.accessToken;
  if (!accessToken) return "reauth";

  const userId = session.userId ?? session.githubLogin ?? "unknown";
  return _checkGitHubAccess(userId, owner, repo, accessToken);
}

/**
 * Assert that the authenticated user has read access to owner/repo via GitHub.
 *
 * - On success: returns void (caller proceeds normally).
 * - On missing session / expired token: redirects to GitHub OAuth.
 * - On 403/404 from GitHub: calls notFound() (renders not-found page).
 *
 * Does NOT check MERGESIGNAL_LINKED_GITHUB_OWNER — that check applies to the
 * single-tenant /org/* routes only. This guard is for the multi-tenant /app/*.
 */
export async function requireRepoAccess(
  owner: string,
  repo: string,
  options?: { redirectTo?: string },
): Promise<void> {
  const redirectTo =
    options?.redirectTo ??
    "/app/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo);
  const signInUrl = buildProviderSignInPath(DEFAULT_AUTH_PROVIDER, redirectTo);

  const session = await auth();

  if (!session) {
    logAuthEvent(AuthLogEvent.GuardUnauthenticated, { redirectTo });
    redirect(signInUrl);
  }

  const result = await checkRepoAccessForSession(session, owner, repo);

  if (result === "reauth") {
    redirect(signInUrl);
  }
  if (result === "forbidden") {
    notFound();
  }
}
